import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { Subscription, catchError, map, of, switchMap } from 'rxjs';
import {
  FriendshipsApi,
  FriendshipResponse,
  FriendshipStatus,
} from 'lib-ruby-sdks/social-service';
import { StationsApi } from 'lib-ruby-sdks/catalog-service';
import { UserResponse, UsersApi } from 'lib-ruby-sdks/auth-service';
import { API_GATEWAY_URL, RealtimePort, WsNotificationPayload } from 'lib-ruby-core';
import { TokenStorageService } from '../../core/services/token-storage.service';
import { FriendsState } from './friends.state';

/* ─────────────────────────────────────────────
   Local notification type — populated via
   realtime WebSocket (RealtimePort.onNotification)
   or via GET /api/v1/realtime/notifications on mount.
───────────────────────────────────────────── */
export type FriendRequestItem = FriendshipResponse & {
  requesterName?: string;
  requesterAvatarUrl?: string;
};

export interface StationNotificationItem {
  id: string;
  userId: string;          // recipient (= current user)
  type: 'STATION_REPLY' | 'FRIEND_REQUEST';
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  meta: {
    stationId?: string;
    stationName?: string;
    actorUserId?: string;
    actorUserName?: string;
    actorAvatarUrl?: string | null;
    commentId?: string;
  };
}

/** Shape returned by `GET /api/v1/realtime/notifications`. */
interface RawNotification {
  _id?: string;
  id?: string;
  user_id: string;
  actor_id: string;
  actor_username: string;
  actor_photo_url: string | null;
  type: 'COMMENT_REACTION' | 'MENTION' | 'FRIEND_REQUEST' | 'FRIEND_ACCEPTED';
  target_id: string;
  target_type: string;
  is_read: boolean;
  is_deleted: boolean;
  created_at: string;
}

interface NotificationsPage {
  content: RawNotification[];
  total: number;
  page: number;
  size: number;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationsState implements OnDestroy {
  private readonly friendshipsApi = inject(FriendshipsApi);
  private readonly stationsApi = inject(StationsApi);
  private readonly usersApi = inject(UsersApi);
  private readonly friendsState = inject(FriendsState);
  private readonly realtimePort = inject(RealtimePort);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly http = inject(HttpClient);
  private readonly gatewayUrl = inject(API_GATEWAY_URL);

  private realtimeSubscription: Subscription | null = null;
  private lastConnectedToken: string | null = null;

  // Caches so a comment or station is only resolved once per session.
  private readonly commentToStationId = new Map<string, string>();
  private readonly stationIdToName = new Map<string, string>();
  /**
   * Cache of actor avatars looked up via auth-service. The JWT does NOT carry
   * profilePhotoUrl (size constraints), so notifications arrive with an empty
   * `actor_photo_url` field. We resolve the actual photo once per actor and
   * patch every matching notification's meta — same pattern used by the
   * Solicitudes tab and Activos estación list.
   *
    * Value semantics:
    *   - missing key: never fetched.
    *   - null: fetch in flight OR fetched with no photo.
    *   - non-empty string: resolved URL.
   */
  private readonly actorAvatarCache = new Map<string, string | null>();

  constructor() {
    // Auto (dis)connect the WebSocket whenever the access token changes.
    // Runs on login (token set), logout (token cleared) and page reload
    // (token restored from localStorage at signal init).
    effect(() => {
      const token = this.tokenStorage.accessToken();
      if (token === this.lastConnectedToken) return;
      if (token) {
        this.connectRealtime(token);
      } else {
        this.disconnectRealtime();
      }
      this.lastConnectedToken = token;
    });
  }

  /* ===================== */
  /* SIGNALS               */
  /* ===================== */

  /** Activity notifications (MENTION + FRIEND_ACCEPTED) merged from WS + HTTP. */
  private readonly _notifications = signal<StationNotificationItem[]>([]);
  readonly notifications = this._notifications.asReadonly();

  /**
   * PENDING friendships (GET /friends/requests/pending). Drives "Solicitudes"
   * tab. Stored as `FriendRequestItem` (extends FriendshipResponse) so we can
   * carry the requester's displayName + avatar alongside the raw ids.
   */
  private readonly _friendRequests = signal<FriendRequestItem[]>([]);
  readonly friendRequests = this._friendRequests.asReadonly();

  /**
   * Unseen counter shown in the left-sidebar bell badge. Increments on every
   * incoming WS push (any type). Reset to 0 when the user opens the
   * notifications page — independent of persisted read/delete state.
   */
  private readonly _unseenCount = signal(0);
  readonly unseenCount = this._unseenCount.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  /* ===================== */
  /* COMPUTED              */
  /* ===================== */

  readonly totalNotifications = computed(() => this._notifications().length);
  readonly totalFriendRequests = computed(() => this._friendRequests().length);

  readonly unreadNotificationsCount = computed(
    () => this._notifications().filter(n => !n.isRead).length
  );

  /* ===================== */
  /* REALTIME              */
  /* ===================== */

  connectRealtime(token: string): void {
    this.realtimePort.connect(token);

    this.realtimeSubscription?.unsubscribe();
    this.realtimeSubscription = this.realtimePort
      .onNotification()
      .subscribe(payload => this.handleWsNotification(payload));
  }

  disconnectRealtime(): void {
    this.realtimeSubscription?.unsubscribe();
    this.realtimeSubscription = null;
    this.realtimePort.disconnect();
  }

  ngOnDestroy(): void {
    this.disconnectRealtime();
  }

  private handleWsNotification(payload: WsNotificationPayload): void {
    // Friend requests have their own tab, sourced from the pending friendships
    // endpoint — refresh that instead of storing the notification as activity.
    if (payload.type === 'FRIEND_REQUEST') {
      this.loadPendingFriendRequests();
      this._unseenCount.update(n => n + 1);
      return;
    }

    const notification: StationNotificationItem = {
      id: payload.notificationId,
      userId: payload.actorId, // kept for template compatibility; not filtered
      type: this.mapNotificationType(payload.type),
      title: this.buildTitle(payload),
      message: this.buildMessage(payload),
      createdAt: payload.createdAt,
      isRead: false,
      meta: {
        actorUserId: payload.actorId,
        actorUserName: payload.actorUsername,
        actorAvatarUrl: payload.actorPhotoUrl ?? null,
        ...(payload.targetType === 'COMMENT' ? { commentId: payload.targetId } : {}),
        ...(payload.targetType === 'STATION' ? { stationId: payload.targetId } : {}),
      },
    };
    this.upsertNotification(notification);
    this.enrichStationInfo(notification.id, notification.meta.commentId);
    this.enrichActorAvatar(notification.id, notification.meta.actorUserId);
    this._unseenCount.update(n => n + 1);

    // Requester side of an accepted friendship: refresh the friends list so
    // station-detail's "Conectar" menu hides the button for this new friend
    // in real time (we don't have the full friendship object in the push).
    if (payload.type === 'FRIEND_ACCEPTED') {
      this.friendsState.loadFriends();
    }
  }

  /**
   * Resolves `commentId → stationId → stationName` and mutates the matching
   * notification's `meta` so the card can render the real station name
   * ("te ha mencionado en la estación <name>"). Silent no-op on any failure.
   * Uses session-level caches to avoid duplicate HTTP hits.
   */
  private enrichStationInfo(notificationId: string, commentId: string | undefined): void {
    if (!commentId) return;

    const cachedStationId = this.commentToStationId.get(commentId);
    if (cachedStationId) {
      this.applyStationId(notificationId, cachedStationId);
      return;
    }

    this.http
      .get<{ station_id?: string }>(`${this.gatewayUrl}/api/v1/realtime/comments/${commentId}`)
      .pipe(catchError(() => of(null)))
      .subscribe((comment) => {
        const stationId = comment?.station_id;
        if (!stationId) return;
        this.commentToStationId.set(commentId, stationId);
        this.applyStationId(notificationId, stationId);
      });
  }

  private applyStationId(notificationId: string, stationId: string): void {
    // First, patch the notification with the stationId so the "Ir" button has
    // immediate navigation data even before the name resolves.
    this._notifications.update((list) =>
      list.map((n) =>
        n.id === notificationId ? { ...n, meta: { ...n.meta, stationId } } : n,
      ),
    );

    const cachedName = this.stationIdToName.get(stationId);
    if (cachedName) {
      this.patchStationName(notificationId, cachedName);
      return;
    }

    this.stationsApi
      .getStationById(stationId)
      .pipe(catchError(() => of(null)))
      .subscribe((station) => {
        const name = station?.name;
        if (!name) return;
        this.stationIdToName.set(stationId, name);
        this.patchStationName(notificationId, name);
      });
  }

  private patchStationName(notificationId: string, stationName: string): void {
    this._notifications.update((list) =>
      list.map((n) =>
        n.id === notificationId
          ? { ...n, meta: { ...n.meta, stationName } }
          : n,
      ),
    );
  }

  /**
   * Resolves the actor's profile photo from auth-service so the Activity card
   * shows the real avatar instead of the placeholder. Shared cache per actor
   * avoids duplicate fetches when several notifications share the same actor.
   */
  private enrichActorAvatar(
    notificationId: string,
    actorUserId: string | undefined,
  ): void {
    if (!actorUserId) return;

    const cached = this.actorAvatarCache.get(actorUserId);
    if (cached !== undefined) {
      // Already resolved or in-flight; patch if we have a value.
      if (cached) this.patchActorAvatar(actorUserId, cached);
      return;
    }

    // Mark as in-flight so parallel notifications don't refire.
    this.actorAvatarCache.set(actorUserId, null);

    this.usersApi
      .getUserById(actorUserId)
      .pipe(catchError(() => of<UserResponse | null>(null)))
      .subscribe((user) => {
        const url = user?.profilePhotoUrl ?? null;
        this.actorAvatarCache.set(actorUserId, url);
        if (url) this.patchActorAvatar(actorUserId, url);
      });
  }

  /**
   * Batch-resolves actor avatars to avoid one HTTP request per notification.
   * Only fetches ids that are not already cached.
   */
  private enrichActorAvatars(actorUserIds: string[]): void {
    const uncached = Array.from(new Set(actorUserIds.filter(Boolean))).filter(
      (id) => !this.actorAvatarCache.has(id),
    );
    if (uncached.length === 0) return;

    // Mark as in-flight to prevent parallel duplicate fetches.
    for (const id of uncached) {
      this.actorAvatarCache.set(id, null);
    }

    this.usersApi.batchGetUsers({ ids: uncached }).subscribe({
      next: (users) => {
        const userMap = new Map(users.filter((u) => !!u.id).map((u) => [u.id!, u]));
        const resolvedAvatars = new Map<string, string>();
        for (const actorUserId of uncached) {
          const url = userMap.get(actorUserId)?.profilePhotoUrl ?? null;
          this.actorAvatarCache.set(actorUserId, url);
          if (url) resolvedAvatars.set(actorUserId, url);
        }

        if (resolvedAvatars.size > 0) {
          this._notifications.update((list) =>
            list.map((n) => {
              const actorUserId = n.meta.actorUserId;
              if (!actorUserId) return n;
              const avatarUrl = resolvedAvatars.get(actorUserId);
              if (!avatarUrl || n.meta.actorAvatarUrl === avatarUrl) return n;
              return { ...n, meta: { ...n.meta, actorAvatarUrl: avatarUrl } };
            }),
          );
        }
      },
      error: () => {
        // Allow retry on next refresh if the bulk request failed.
        for (const actorUserId of uncached) {
          this.actorAvatarCache.delete(actorUserId);
        }
      },
    });
  }

  /** Patches every in-memory notification authored by `actorUserId`. */
  private patchActorAvatar(actorUserId: string, avatarUrl: string): void {
    this._notifications.update((list) =>
      list.map((n) =>
        n.meta.actorUserId === actorUserId
          ? { ...n, meta: { ...n.meta, actorAvatarUrl: avatarUrl } }
          : n,
      ),
    );
  }

  /**
   * MENTION, COMMENT_REACTION and FRIEND_ACCEPTED are all informational items
   * that render in the "Actividad" tab. FRIEND_REQUEST is handled separately
   * (see handleWsNotification) and never reaches this helper.
   */
  private mapNotificationType(
    type: WsNotificationPayload['type']
  ): StationNotificationItem['type'] {
    return 'STATION_REPLY';
  }

  private buildTitle(payload: WsNotificationPayload): string {
    switch (payload.type) {
      case 'COMMENT_REACTION': return `${payload.actorUsername} reaccionó a tu comentario`;
      case 'MENTION':          return `${payload.actorUsername} te mencionó en una estación`;
      case 'FRIEND_REQUEST':   return `${payload.actorUsername} te envió una solicitud`;
      case 'FRIEND_ACCEPTED':  return `${payload.actorUsername} aceptó tu solicitud`;
      default:                 return 'Nueva notificación';
    }
  }

  private buildMessage(payload: WsNotificationPayload): string {
    switch (payload.type) {
      case 'COMMENT_REACTION': return `reaccionó a tu comentario`;
      case 'MENTION':          return `te ha mencionado en la estación`;
      case 'FRIEND_REQUEST':   return `quiere conectar contigo`;
      case 'FRIEND_ACCEPTED':  return `aceptó tu solicitud — ahora son amigos`;
      default:                 return '';
    }
  }

  /* ===================== */
  /* LOADERS               */
  /* ===================== */

  /**
   * Loads the persisted activity notifications (MENTION / FRIEND_ACCEPTED /
   * COMMENT_REACTION) from realtime-api-ms so the screen is not empty after a
   * page reload. Merges with existing entries — dedupe is by notification id.
   */
  loadNotifications(): void {
    this._loading.set(true);
    this._error.set(null);
    this.http
      .get<NotificationsPage>(`${this.gatewayUrl}/api/v1/realtime/notifications`, {
        params: { page: '0', size: '50' },
      })
      .subscribe({
        next: (page) => {
          const mapped = (page.content ?? [])
            .filter(raw => raw.type !== 'FRIEND_REQUEST')
            .map(raw => this.mapRawNotification(raw));
          let newlyLoaded: StationNotificationItem[] = [];
          this._notifications.update((current) => {
            const seen = new Set(current.map(n => n.id));
            const toPrepend = mapped.filter(n => !seen.has(n.id));
            newlyLoaded = toPrepend;
            // Historical comes newest-first from the API; WS items accumulate
            // at the top via upsertNotification. Merge both keeping newest
            // first by createdAt.
            const combined = [...current, ...toPrepend];
            combined.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            );
            return combined;
          });

          // Kick off station-name enrichment only for newly loaded mentions
          // that still lack one. Runs async per notification — the UI paints
          // the placeholder message first, then swaps in the real name.
          for (const n of newlyLoaded) {
            if (!n.meta.stationName && n.meta.commentId) {
              this.enrichStationInfo(n.id, n.meta.commentId);
            }
          }

          // Resolve missing avatars in one bulk request instead of N getUserById.
          this.enrichActorAvatars(
            newlyLoaded
              .filter((n) => !n.meta.actorAvatarUrl && !!n.meta.actorUserId)
              .map((n) => n.meta.actorUserId as string),
          );

          this._loading.set(false);
        },
        error: (err: { message?: string }) => {
          this._error.set(err?.message ?? 'Error loading notifications');
          this._loading.set(false);
        },
      });
  }

  loadPendingFriendRequests(): void {
    this._loading.set(true);
    this._error.set(null);
    this.friendshipsApi
      .getPendingRequests()
      .pipe(
        switchMap((requests) => {
          if (!requests.length) return of<FriendRequestItem[]>([]);
          // FriendshipResponse only carries ids — fetch requesters in batch so
          // the Solicitudes card renders real names/avatars without N calls.
          const requesterIds = Array.from(
            new Set(requests.map((r) => r.requesterId).filter((id): id is string => !!id)),
          );

          if (!requesterIds.length) {
            return of(
              requests.map(
                (r) =>
                  ({
                    ...r,
                    requesterName: r.requesterId,
                    requesterAvatarUrl: undefined,
                  }) as FriendRequestItem,
              ),
            );
          }

          return this.usersApi.batchGetUsers({ ids: requesterIds }).pipe(
            catchError(() => of<UserResponse[]>([])),
            map((users) => {
              const userMap = new Map(users.filter((u) => !!u.id).map((u) => [u.id!, u]));
              return requests.map(
                (r) =>
                  ({
                    ...r,
                    requesterName: userMap.get(r.requesterId ?? '')?.displayName ?? r.requesterId,
                    requesterAvatarUrl: userMap.get(r.requesterId ?? '')?.profilePhotoUrl ?? undefined,
                  }) as FriendRequestItem,
              );
            }),
          );
        }),
      )
      .subscribe({
        next: (requests) => {
          this._friendRequests.set(requests);
          this._loading.set(false);
        },
        error: (err: { message?: string }) => {
          this._error.set(err?.message ?? 'Error loading friend requests');
          this._loading.set(false);
        },
      });
  }

  refreshFromServer(): void {
    this.loadNotifications();
    this.loadPendingFriendRequests();
  }

  private mapRawNotification(raw: RawNotification): StationNotificationItem {
    return {
      id: raw._id ?? raw.id ?? '',
      userId: raw.user_id,
      type: 'STATION_REPLY',
      title: `${raw.actor_username} te mencionó en una estación`,
      message: this.buildMessageFromType(raw.type),
      createdAt: raw.created_at,
      isRead: raw.is_read ?? false,
      meta: {
        actorUserId: raw.actor_id,
        actorUserName: raw.actor_username,
        actorAvatarUrl: raw.actor_photo_url ?? null,
        ...(raw.target_type === 'COMMENT' ? { commentId: raw.target_id } : {}),
        ...(raw.target_type === 'STATION' ? { stationId: raw.target_id } : {}),
      },
    };
  }

  private buildMessageFromType(type: RawNotification['type']): string {
    switch (type) {
      case 'COMMENT_REACTION': return 'reaccionó a tu comentario';
      case 'MENTION':          return 'te ha mencionado en la estación';
      case 'FRIEND_ACCEPTED':  return 'aceptó tu solicitud — ahora son amigos';
      default:                 return '';
    }
  }

  /* ===================== */
  /* GETTERS               */
  /* ===================== */

  getActivityNotificationsByUser(_userId: string): StationNotificationItem[] {
    // `_notifications` already holds only activity items for the current user
    // (the WS delivers per-room and the HTTP load is scoped by JWT), so no
    // per-user filter is needed. Kept the userId arg for template compat.
    return this._notifications();
  }

  getPendingFriendRequestsForUser(_userId: string): FriendRequestItem[] {
    return this._friendRequests().filter(
      r => r.status === FriendshipStatus.PENDING
    );
  }

  markRequestsAsViewedForUser(_userId: string): void {
    // no-op: friend request "viewed" state is not tracked locally
  }

  hasUnreadActivityForUser(_userId: string): boolean {
    return this._notifications().some(item => !item.isRead);
  }

  hasUnreadRequestsForUser(_userId: string): boolean {
    return this._friendRequests().some(r => r.status === FriendshipStatus.PENDING);
  }

  /* ===================== */
  /* UNSEEN COUNTER        */
  /* ===================== */

  /** Called when the user opens the notifications page. */
  resetUnseenCount(): void {
    this._unseenCount.set(0);
  }

  /* ===================== */
  /* FRIEND REQUEST ACTIONS */
  /* ===================== */

  acceptFriendRequest(friendshipId: string, onSuccess?: () => void): void {
    this._loading.set(true);
    this._error.set(null);
    this.friendshipsApi.acceptFriendRequest(friendshipId).subscribe({
      next: (accepted) => {
        this._friendRequests.update(list =>
          list.filter(r => r.id !== friendshipId)
        );
        // Sync FriendsState so station-detail's "Conectar" menu hides
        // reactively without requiring a page reload.
        this.friendsState.appendAcceptedFriendship(accepted);
        this._loading.set(false);
        onSuccess?.();
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error accepting friend request');
        this._loading.set(false);
      },
    });
  }

  rejectFriendRequest(friendshipId: string, onSuccess?: () => void): void {
    this._loading.set(true);
    this._error.set(null);
    this.friendshipsApi.rejectFriendRequest(friendshipId).subscribe({
      next: () => {
        this._friendRequests.update(list =>
          list.filter(r => r.id !== friendshipId)
        );
        this._loading.set(false);
        onSuccess?.();
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error rejecting friend request');
        this._loading.set(false);
      },
    });
  }

  /* ===================== */
  /* ACTIVITY NOTIFICATIONS */
  /* ===================== */

  /**
   * Adds a new WS-delivered notification to the top of the list, deduping by
   * id in case the HTTP load arrived after the push for the same item.
   */
  upsertNotification(notification: StationNotificationItem): void {
    this._notifications.update(list => {
      if (list.some(n => n.id === notification.id)) return list;
      return [notification, ...list];
    });
  }

  /**
   * Persist mark-as-read on the backend (PATCH /notifications/read-all) and
   * flip the local isRead flag so the unread counter collapses to 0 across
   * reloads. Called when the user opens the Activity tab.
   */
  markActivityAsReadForUser(_userId: string): void {
    const hadUnread = this._notifications().some(n => !n.isRead);
    this._notifications.update(list => list.map(n => (n.isRead ? n : { ...n, isRead: true })));
    if (!hadUnread) return;

    this.http
      .patch(`${this.gatewayUrl}/api/v1/realtime/notifications/read-all`, {})
      .subscribe({
        next: () => { /* silent — state already updated optimistically */ },
        error: () => { /* best-effort; re-opening the page will re-sync via loadNotifications */ },
      });
  }

  /**
   * Soft-deletes a notification on the backend and removes it locally.
   * Optimistic: the local list is updated first; on failure the state may be
   * out of sync until next `loadNotifications()`.
   */
  deleteNotification(notificationId: string): void {
    this._notifications.update(list => list.filter(item => item.id !== notificationId));
    this.http
      .delete(`${this.gatewayUrl}/api/v1/realtime/notifications/${notificationId}`)
      .subscribe({
        next: () => { /* silent */ },
        error: () => { /* stays removed locally; re-opening may bring it back */ },
      });
  }

  /* ===================== */
  /* UTILS                 */
  /* ===================== */

  clearError(): void {
    this._error.set(null);
  }
}
