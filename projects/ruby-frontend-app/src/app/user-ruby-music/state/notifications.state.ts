import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  FriendshipsApi,
  FriendshipResponse,
  FriendshipStatus,
} from 'lib-ruby-sdks/social-service';
import { RealtimePort, WsNotificationPayload } from 'lib-ruby-core';

/* ─────────────────────────────────────────────
   Local notification type — populated via
   realtime WebSocket (RealtimePort.onNotification)
───────────────────────────────────────────── */
export type FriendRequestItem = FriendshipResponse & {
  requesterName?: string;
  requesterAvatarUrl?: string;
};

export interface StationNotificationItem {
  id: string;
  userId: string;
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
    commentId?: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class NotificationsState implements OnDestroy {
  private readonly friendshipsApi = inject(FriendshipsApi);
  private readonly realtimePort = inject(RealtimePort);

  private realtimeSubscription: Subscription | null = null;

  /* ===================== */
  /* SIGNALS               */
  /* ===================== */

  /**
   * Activity notifications received via WebSocket (STATION_REPLY, MENTION, etc.).
   * Call connectRealtime(token) after login to start receiving them.
   */
  private readonly _notifications = signal<StationNotificationItem[]>([]);
  readonly notifications = this._notifications.asReadonly();

  /** Incoming PENDING friend requests loaded from the social SDK. */
  private readonly _friendRequests = signal<FriendshipResponse[]>([]);
  readonly friendRequests = this._friendRequests.asReadonly();

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

  /**
   * Opens the WebSocket connection and starts receiving push notifications.
   * Call this immediately after the user logs in (pass JWT access token).
   * Safe to call multiple times — re-connects if previously disconnected.
   */
  connectRealtime(token: string): void {
    this.realtimePort.connect(token);

    // Clean up any previous subscription before re-subscribing
    this.realtimeSubscription?.unsubscribe();
    this.realtimeSubscription = this.realtimePort
      .onNotification()
      .subscribe(payload => this.handleWsNotification(payload));
  }

  /**
   * Closes the WebSocket connection and stops receiving notifications.
   * Call this when the user logs out.
   */
  disconnectRealtime(): void {
    this.realtimeSubscription?.unsubscribe();
    this.realtimeSubscription = null;
    this.realtimePort.disconnect();
  }

  ngOnDestroy(): void {
    this.disconnectRealtime();
  }

  private handleWsNotification(payload: WsNotificationPayload): void {
    const notification: StationNotificationItem = {
      id: payload.notificationId,
      userId: payload.actorId, // populated for routing; recipient is current user
      type: this.mapNotificationType(payload.type),
      title: this.buildTitle(payload),
      message: this.buildMessage(payload),
      createdAt: payload.createdAt,
      isRead: false,
      meta: {
        actorUserId: payload.actorId,
        actorUserName: payload.actorUsername,
        ...(payload.targetType === 'COMMENT' ? { commentId: payload.targetId } : {}),
        ...(payload.targetType === 'STATION' ? { stationId: payload.targetId } : {}),
      },
    };
    this.pushNotification(notification);
  }

  private mapNotificationType(
    type: WsNotificationPayload['type']
  ): StationNotificationItem['type'] {
    if (type === 'FRIEND_REQUEST' || type === 'FRIEND_ACCEPTED') {
      return 'FRIEND_REQUEST';
    }
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
      case 'COMMENT_REACTION': return `A ${payload.actorUsername} le gustó tu comentario`;
      case 'MENTION':          return `${payload.actorUsername} te mencionó`;
      case 'FRIEND_REQUEST':   return `${payload.actorUsername} quiere conectar contigo`;
      case 'FRIEND_ACCEPTED':  return `Ahora son amigos con ${payload.actorUsername}`;
      default:                 return '';
    }
  }

  /* ===================== */
  /* LOADERS               */
  /* ===================== */

  loadPendingFriendRequests(): void {
    this._loading.set(true);
    this._error.set(null);
    this.friendshipsApi.getPendingRequests().subscribe({
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
    this.loadPendingFriendRequests();
  }

  /* ===================== */
  /* GETTERS               */
  /* ===================== */

  getActivityNotificationsByUser(userId: string): StationNotificationItem[] {
    return this._notifications()
      .filter(item => item.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getPendingFriendRequestsForUser(_userId: string): FriendRequestItem[] {
    return this._friendRequests().filter(
      r => r.status === FriendshipStatus.PENDING
    ) as FriendRequestItem[];
  }

  markRequestsAsViewedForUser(_userId: string): void {
    // no-op: friend request "viewed" state is not tracked locally
  }

  hasUnreadActivityForUser(userId: string): boolean {
    return this._notifications().some(item => item.userId === userId && !item.isRead);
  }

  hasUnreadRequestsForUser(_userId: string): boolean {
    return this._friendRequests().some(r => r.status === FriendshipStatus.PENDING);
  }

  /* ===================== */
  /* FRIEND REQUEST ACTIONS */
  /* ===================== */

  acceptFriendRequest(friendshipId: string, onSuccess?: () => void): void {
    this._loading.set(true);
    this._error.set(null);
    this.friendshipsApi.acceptFriendRequest(friendshipId).subscribe({
      next: () => {
        this._friendRequests.update(list =>
          list.filter(r => r.id !== friendshipId)
        );
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

  pushNotification(notification: StationNotificationItem): void {
    this._notifications.update(list => [notification, ...list]);
  }

  markActivityAsReadForUser(userId: string): void {
    this._notifications.update(list =>
      list.map(item =>
        item.userId === userId && !item.isRead ? { ...item, isRead: true } : item
      )
    );
  }

  deleteNotification(notificationId: string): void {
    this._notifications.update(list =>
      list.filter(item => item.id !== notificationId)
    );
  }

  /* ===================== */
  /* UTILS                 */
  /* ===================== */

  clearError(): void {
    this._error.set(null);
  }
}
