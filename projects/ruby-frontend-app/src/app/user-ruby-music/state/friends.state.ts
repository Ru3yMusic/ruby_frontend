import { Injectable, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import {
  FriendshipsApi,
  FriendshipResponse,
  FriendshipStatus,
} from 'lib-ruby-sdks/social-service';
import { RealtimePort } from 'lib-ruby-core';

export interface FriendListItem {
  id: string;
  friendId: string;
  friendName: string;
  friendAvatarUrl: string | null;
  isOnline: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class FriendsState {
  private readonly friendshipsApi = inject(FriendshipsApi);
  private readonly realtimePort = inject(RealtimePort);

  constructor() {
    // Sync _friends across tabs / devices: when any session emits
    // friend_removed via WS, drop the row from our list so station-detail's
    // "Conectar" menu reappears automatically and the friends page row
    // disappears without reload.
    this.realtimePort.onFriendRemoved().subscribe((payload) => {
      if (!payload?.friendshipId) return;
      this._friends.update((list) =>
        list.filter((f) => f.id !== payload.friendshipId),
      );
      this._pendingRequests.update((list) =>
        list.filter((r) => r.id !== payload.friendshipId),
      );
    });
  }

  /* ===================== */
  /* SIGNALS */
  /* ===================== */

  private readonly _friends = signal<FriendshipResponse[]>([]);
  readonly friends = this._friends.asReadonly();

  private readonly _pendingRequests = signal<FriendshipResponse[]>([]);
  readonly pendingRequests = this._pendingRequests.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  // Inflight de cargas idempotentes (loadFriends, loadPendingRequests). Sin esto,
  // varios componentes (LeftSidebar, station-detail, /friends, layout) llamando
  // refreshAll() casi simultáneamente disparaban requests duplicadas que se
  // serializaban en social-service y saturaban el límite de 6 conexiones del browser.
  private readonly inflightLoaders = new Set<string>();
  private activeLoaderCount = 0;

  /* ===================== */
  /* COMPUTED */
  /* ===================== */

  readonly totalFriendships = computed(() => this._friends().length);
  readonly hasPendingRequests = computed(() => this._pendingRequests().length > 0);
  readonly pendingRequestsCount = computed(() => this._pendingRequests().length);

  /* ===================== */
  /* LOADERS */
  /* ===================== */

  loadFriends(): void {
    if (!this.beginLoader('friends')) return;
    this._error.set(null);
    this.friendshipsApi.listFriends().pipe(
      finalize(() => this.endLoader('friends')),
    ).subscribe({
      next: (friends) => {
        this._friends.set(friends);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading friends');
      },
    });
  }

  loadPendingRequests(): void {
    if (!this.beginLoader('pending-requests')) return;
    this._error.set(null);
    this.friendshipsApi.getPendingRequests().pipe(
      finalize(() => this.endLoader('pending-requests')),
    ).subscribe({
      next: (requests) => {
        this._pendingRequests.set(requests);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading pending requests');
      },
    });
  }

  private beginLoader(key: string): boolean {
    if (this.inflightLoaders.has(key)) return false;
    this.inflightLoaders.add(key);
    this.activeLoaderCount += 1;
    this._loading.set(true);
    return true;
  }

  private endLoader(key: string): void {
    if (!this.inflightLoaders.delete(key)) return;
    this.activeLoaderCount = Math.max(0, this.activeLoaderCount - 1);
    if (this.activeLoaderCount === 0) {
      this._loading.set(false);
    }
  }

  refreshAll(): void {
    this.loadFriends();
    this.loadPendingRequests();
  }

  /**
   * Adds an already-ACCEPTED friendship to the in-memory list. Used by flows
   * that bypass this state's own accept method (e.g. NotificationsState calls
   * the SDK directly and then tells us the result) so signals stay in sync
   * and station-detail's "Conectar" menu hides reactively without reloading.
   */
  appendAcceptedFriendship(friendship: FriendshipResponse): void {
    if (!friendship?.id) return;
    this._friends.update(list => {
      if (list.some(f => f.id === friendship.id)) return list;
      return [...list, friendship];
    });
  }

  /* ===================== */
  /* GETTERS */
  /* ===================== */

  getFriendshipById(friendshipId: string): FriendshipResponse | undefined {
    return this._friends().find(f => f.id === friendshipId);
  }

  isFriendWith(currentUserId: string, otherUserId: string): boolean {
    return this._friends().some(
      f =>
        f.status === FriendshipStatus.ACCEPTED &&
        ((f.requesterId === currentUserId && f.addresseeId === otherUserId) ||
          (f.requesterId === otherUserId && f.addresseeId === currentUserId))
    );
  }

  getFriendsByUser(currentUserId: string): FriendListItem[] {
    return this._friends()
      .filter(f => f.status === FriendshipStatus.ACCEPTED)
      .map(f => {
        const friendUserId = f.requesterId === currentUserId
          ? (f.addresseeId ?? '')
          : (f.requesterId ?? '');
        return {
          id: f.id ?? '',
          friendId: friendUserId,
          friendName: friendUserId,
          friendAvatarUrl: null,
          isOnline: false,
        };
      });
  }

  getFriendIdList(currentUserId: string): string[] {
    return this._friends()
      .filter(f => f.status === FriendshipStatus.ACCEPTED)
      .map(f =>
        f.requesterId === currentUserId ? (f.addresseeId ?? '') : (f.requesterId ?? '')
      )
      .filter(id => id.length > 0);
  }

  /* ===================== */
  /* FRIEND REQUEST ACTIONS */
  /* ===================== */

  sendFriendRequest(
    addresseeId: string,
    onSuccess?: (response: FriendshipResponse) => void,
    onError?: (err: { error?: { message?: string }; message?: string }) => void,
  ): void {
    this._loading.set(true);
    this._error.set(null);
    this.friendshipsApi.sendFriendRequest({ addresseeId }).subscribe({
      next: (response) => {
        this._loading.set(false);
        onSuccess?.(response);
      },
      error: (err: { error?: { message?: string }; message?: string }) => {
        // Prefer the backend's body message (e.g. "Friend request already pending")
        // so the caller can route to the right user-facing toast.
        this._error.set(err?.error?.message ?? err?.message ?? 'Error sending friend request');
        this._loading.set(false);
        onError?.(err);
      },
    });
  }

  acceptFriendRequest(friendshipId: string, onSuccess?: () => void): void {
    this._loading.set(true);
    this._error.set(null);
    this.friendshipsApi.acceptFriendRequest(friendshipId).subscribe({
      next: (accepted) => {
        // Move from pending to friends
        this._pendingRequests.update(list => list.filter(r => r.id !== friendshipId));
        this._friends.update(list => [...list, accepted]);
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
        this._pendingRequests.update(list => list.filter(r => r.id !== friendshipId));
        this._loading.set(false);
        onSuccess?.();
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error rejecting friend request');
        this._loading.set(false);
      },
    });
  }

  /**
   * Removes a friendship. `otherUserId` is the counterpart user's id — when
   * provided, a `friend_removed` WS event is relayed so the other session
   * drops the row in real time (and any secondary tab of the caller too).
   */
  removeFriend(
    friendshipId: string,
    otherUserId?: string,
    onSuccess?: () => void,
  ): void {
    this._loading.set(true);
    this._error.set(null);
    this.friendshipsApi.removeFriend(friendshipId).subscribe({
      next: () => {
        this._friends.update(list => list.filter(f => f.id !== friendshipId));
        if (otherUserId) {
          this.realtimePort.emitFriendRemoved(friendshipId, otherUserId);
        }
        this._loading.set(false);
        onSuccess?.();
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error removing friend');
        this._loading.set(false);
      },
    });
  }

  /* ===================== */
  /* UTILS */
  /* ===================== */

  clearError(): void {
    this._error.set(null);
  }
}
