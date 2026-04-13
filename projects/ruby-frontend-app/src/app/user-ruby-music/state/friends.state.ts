import { Injectable, computed, inject, signal } from '@angular/core';
import {
  FriendshipsApi,
  FriendshipResponse,
  FriendshipStatus,
} from 'lib-ruby-sdks/social-service';

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
    this._loading.set(true);
    this._error.set(null);
    this.friendshipsApi.listFriends().subscribe({
      next: (friends) => {
        this._friends.set(friends);
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading friends');
        this._loading.set(false);
      },
    });
  }

  loadPendingRequests(): void {
    this._loading.set(true);
    this._error.set(null);
    this.friendshipsApi.getPendingRequests().subscribe({
      next: (requests) => {
        this._pendingRequests.set(requests);
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading pending requests');
        this._loading.set(false);
      },
    });
  }

  refreshAll(): void {
    this.loadFriends();
    this.loadPendingRequests();
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

  sendFriendRequest(addresseeId: string, onSuccess?: (response: FriendshipResponse) => void): void {
    this._loading.set(true);
    this._error.set(null);
    this.friendshipsApi.sendFriendRequest({ addresseeId }).subscribe({
      next: (response) => {
        this._loading.set(false);
        onSuccess?.(response);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error sending friend request');
        this._loading.set(false);
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

  removeFriend(friendshipId: string, onSuccess?: () => void): void {
    this._loading.set(true);
    this._error.set(null);
    this.friendshipsApi.removeFriend(friendshipId).subscribe({
      next: () => {
        this._friends.update(list => list.filter(f => f.id !== friendshipId));
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
