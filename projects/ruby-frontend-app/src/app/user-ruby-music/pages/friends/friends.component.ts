import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FriendshipStatus } from 'lib-ruby-sdks/social-service';
import { UsersApi, UserResponse } from 'lib-ruby-sdks/auth-service';
import { BulkPresenceResult, RealtimePort } from 'lib-ruby-core';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { FriendListItem, FriendsState } from '../../state/friends.state';

@Component({
  selector: 'app-friends',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './friends.component.html',
  styleUrls: ['./friends.component.scss'],
})
export class FriendsComponent {
  private readonly authState = inject(AuthState);
  private readonly friendsState = inject(FriendsState);
  private readonly usersApi = inject(UsersApi);
  private readonly realtimePort = inject(RealtimePort);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentUser = this.authState.currentUser;

  readonly searchTerm = signal('');

  readonly isRemoveModalOpen = signal(false);
  readonly selectedFriend = signal<FriendListItem | null>(null);

  readonly toastMessage = signal('');
  readonly isToastVisible = signal(false);

  /**
   * Enriched friend list: raw ACCEPTED friendships from FriendsState combined
   * with the friend's real displayName + avatar (auth-service batch lookup)
   * and online state (ws-ms bulk presence). Patched live via WS
   * `user_presence_changed` so Activo/Inactivo switches without reload.
   */
  private readonly _enrichedFriends = signal<FriendListItem[]>([]);

  readonly filteredFriends = computed<FriendListItem[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const friends = this._enrichedFriends();
    if (!term) return friends;
    return friends.filter(friend =>
      friend.friendName.toLowerCase().includes(term)
    );
  });

  readonly totalFriends = computed(() => this.filteredFriends().length);

  constructor() {
    this.friendsState.refreshAll();

    // Rebuild the enriched list whenever the raw friendship list changes
    // (initial load, accept via notifications, remove from this screen).
    effect(() => {
      const user = this.currentUser();
      if (!user?.id) {
        this._enrichedFriends.set([]);
        return;
      }

      const allFriends = this.friendsState.friends();
      const accepted = allFriends.filter(
        f => f.status === FriendshipStatus.ACCEPTED,
      );
      if (accepted.length === 0) {
        this._enrichedFriends.set([]);
        return;
      }

      const currentUserId = user.id;
      const friendIds = accepted
        .map(f =>
          f.requesterId === currentUserId
            ? (f.addresseeId ?? '')
            : (f.requesterId ?? ''),
        )
        .filter(id => id.length > 0);

      if (friendIds.length === 0) {
        this._enrichedFriends.set([]);
        return;
      }

      forkJoin({
        users: this.usersApi
          .batchGetUsers({ ids: friendIds })
          .pipe(catchError(() => of<UserResponse[]>([]))),
        presence: this.realtimePort
          .getBulkPresence(friendIds)
          .pipe(catchError(() => of<BulkPresenceResult>({}))),
      }).subscribe(({ users, presence }) => {
        const userMap = new Map(users.map(u => [u.id!, u]));

        const enriched: FriendListItem[] = accepted.flatMap(f => {
          const friendUserId =
            f.requesterId === currentUserId
              ? (f.addresseeId ?? '')
              : (f.requesterId ?? '');
          if (!friendUserId) return [];

          const userInfo = userMap.get(friendUserId);
          const presenceInfo = presence[friendUserId];

          return [{
            id: f.id ?? '',
            friendId: friendUserId,
            friendName: userInfo?.displayName ?? friendUserId,
            friendAvatarUrl: userInfo?.profilePhotoUrl ?? null,
            isOnline: presenceInfo?.online ?? false,
          }];
        });

        this._enrichedFriends.set(enriched);
      });
    });

    // Realtime presence stream: patch the matching friend's isOnline in place
    // so Activo/Inactivo switches without reloading the page. A friend logging
    // out (handleDisconnect on the server) emits `online: false`; joining a
    // station emits `online: true`.
    this.realtimePort.onUserPresenceChanged()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload) => {
        const current = this._enrichedFriends();
        const idx = current.findIndex(f => f.friendId === payload.userId);
        if (idx === -1) return;
        const updated = [...current];
        updated[idx] = { ...current[idx], isOnline: payload.online };
        this._enrichedFriends.set(updated);
      });
  }

  updateSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  openRemoveFriendModal(friend: FriendListItem): void {
    this.selectedFriend.set(friend);
    this.isRemoveModalOpen.set(true);
  }

  closeRemoveFriendModal(): void {
    this.isRemoveModalOpen.set(false);
    this.selectedFriend.set(null);
  }

  confirmRemoveFriend(): void {
    const friend = this.selectedFriend();
    if (!friend) return;

    // Pass the other user's id so FriendsState can fan-out `friend_removed`
    // over WS → the removed friend's session drops the row instantly and
    // station-detail's "Conectar" menu reappears on their side without F5.
    this.friendsState.removeFriend(friend.id, friend.friendId);
    this.closeRemoveFriendModal();
    this.showToast('Amigo eliminado de tu lista');
  }

  isFriendOnline(friend: FriendListItem): boolean {
    return friend.isOnline;
  }

  getFriendAvatar(friend: FriendListItem): string {
    return friend.friendAvatarUrl || '/assets/icons/avatar-placeholder.png';
  }

  trackByFriend(_: number, friend: FriendListItem): string {
    return friend.id;
  }

  private showToast(message: string): void {
    this.toastMessage.set(message);
    this.isToastVisible.set(true);

    window.setTimeout(() => {
      this.isToastVisible.set(false);
      this.toastMessage.set('');
    }, 2200);
  }
}