import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
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

  constructor() {
    this.friendsState.refreshAll();
  }

  private readonly authState = inject(AuthState);
  private readonly friendsState = inject(FriendsState);

  readonly currentUser = this.authState.currentUser;

  readonly searchTerm = signal('');

  readonly isRemoveModalOpen = signal(false);
  readonly selectedFriend = signal<FriendListItem | null>(null);

  readonly toastMessage = signal('');
  readonly isToastVisible = signal(false);

readonly friends = computed<FriendListItem[]>(() => {
  const user = this.currentUser();
  if (!user?.id) return [];

  return this.friendsState.getFriendsByUser(user.id);
});

  readonly filteredFriends = computed<FriendListItem[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const friends = this.friends();

    if (!term) return friends;

    return friends.filter(friend =>
      friend.friendName.toLowerCase().includes(term)
    );
  });

  readonly totalFriends = computed(() => this.filteredFriends().length);

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

    this.friendsState.removeFriend(friend.id);
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