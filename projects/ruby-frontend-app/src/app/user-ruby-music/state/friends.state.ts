import { Injectable, computed, signal } from '@angular/core';

export interface FriendshipItem {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: string;
}

export interface AuthUserItem {
  id: string;
  email: string;
  password: string;
  authProvider: 'EMAIL';
  name: string;
  birthDate: string;
  gender: string;
  avatarUrl: string | null;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'BLOCKED' | 'INACTIVE';
  blockReason: string | null;
  blockedAt: string | null;
  onboardingCompleted: boolean;
  selectedStationIds: string[];
  createdAt: string;
}

export interface FriendPresenceItem {
  userId: string;
  isOnline: boolean;
  lastSeenAt: string;
}

export interface FriendListItem {
  id: string;
  friendUserId: string;
  friendName: string;
  friendAvatarUrl: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  friendshipCreatedAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class FriendsState {
  private readonly FRIENDSHIPS_KEY = 'ruby_friendships';
  private readonly AUTH_USERS_KEY = 'ruby_auth_users';
  private readonly USER_PRESENCE_KEY = 'ruby_user_presence';

  private readonly _friendships = signal<FriendshipItem[]>(
    this.loadStorageArray<FriendshipItem>(this.FRIENDSHIPS_KEY)
  );
  readonly friendships = this._friendships.asReadonly();

  private readonly _authUsers = signal<AuthUserItem[]>(
    this.loadStorageArray<AuthUserItem>(this.AUTH_USERS_KEY)
  );
  readonly authUsers = this._authUsers.asReadonly();

  private readonly _userPresence = signal<FriendPresenceItem[]>(
    this.loadStorageArray<FriendPresenceItem>(this.USER_PRESENCE_KEY)
  );
  readonly userPresence = this._userPresence.asReadonly();

  readonly totalFriendships = computed(() => this._friendships().length);

  /* ===================== */
  /* GETTERS */
  /* ===================== */
  getFriendsByUser(userId: string): FriendListItem[] {
    const users = this._authUsers();
    const presence = this._userPresence();

    return this._friendships()
      .filter(
        friendship =>
          friendship.userAId === userId || friendship.userBId === userId
      )
      .map(friendship => {
        const friendUserId =
          friendship.userAId === userId ? friendship.userBId : friendship.userAId;

        const friendUser = users.find(user => user.id === friendUserId);
        const friendPresence = presence.find(item => item.userId === friendUserId);

        return {
          id: friendship.id,
          friendUserId,
          friendName: friendUser?.name ?? 'Usuario desconocido',
          friendAvatarUrl: friendUser?.avatarUrl ?? null,
          isOnline: friendPresence?.isOnline ?? false,
          lastSeenAt: friendPresence?.lastSeenAt ?? null,
          friendshipCreatedAt: friendship.createdAt,
        } satisfies FriendListItem;
      })
      .sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;

        return a.friendName.localeCompare(b.friendName, 'es', {
          sensitivity: 'base',
        });
      });
  }

  areUsersFriends(userAId: string, userBId: string): boolean {
    return this._friendships().some(
      friendship =>
        (friendship.userAId === userAId && friendship.userBId === userBId) ||
        (friendship.userAId === userBId && friendship.userBId === userAId)
    );
  }

  /* ===================== */
  /* DELETE */
  /* ===================== */
  removeFriendship(friendshipId: string): void {
    const updated = this._friendships().filter(
      friendship => friendship.id !== friendshipId
    );

    this.persistFriendships(updated);
  }

  removeFriendshipBetweenUsers(userAId: string, userBId: string): void {
    const updated = this._friendships().filter(
      friendship =>
        !(
          (friendship.userAId === userAId && friendship.userBId === userBId) ||
          (friendship.userAId === userBId && friendship.userBId === userAId)
        )
    );

    this.persistFriendships(updated);
  }

  /* ===================== */
  /* PRESENCE */
  /* ===================== */
  refreshPresence(): void {
    this._userPresence.set(
      this.loadStorageArray<FriendPresenceItem>(this.USER_PRESENCE_KEY)
    );
  }

  refreshUsers(): void {
    this._authUsers.set(
      this.loadStorageArray<AuthUserItem>(this.AUTH_USERS_KEY)
    );
  }

  refreshFriendships(): void {
    this._friendships.set(
      this.loadStorageArray<FriendshipItem>(this.FRIENDSHIPS_KEY)
    );
  }

  refreshAll(): void {
    this.refreshFriendships();
    this.refreshUsers();
    this.refreshPresence();
  }

  /* ===================== */
  /* HELPERS */
  /* ===================== */
  private persistFriendships(items: FriendshipItem[]): void {
    this._friendships.set(items);
    localStorage.setItem(this.FRIENDSHIPS_KEY, JSON.stringify(items));
  }

  private loadStorageArray<T>(storageKey: string): T[] {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
}