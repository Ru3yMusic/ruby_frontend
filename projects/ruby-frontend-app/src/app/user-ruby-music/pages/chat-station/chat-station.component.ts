import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';

interface FriendshipItem {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: string;
}

interface AuthUserItem {
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

interface StationPresenceItem {
  stationId: string;
  userId: string;
  enteredAt: string;
}

interface StoredStation {
  id: string;
  name: string;
  genreId: string;
  songIds: string[];
  gradientStart: string;
  gradientEnd: string;
  liveListeners: number;
  createdAt: string;
}

interface ChatStationFriendItem {
  friendshipId: string;
  friendUserId: string;
  friendName: string;
  friendAvatarUrl: string | null;
  stationId: string;
  stationName: string;
  enteredAt: string;
}

@Component({
  selector: 'app-chat-station',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat-station.component.html',
  styleUrls: ['./chat-station.component.scss'],
})
export class ChatStationComponent {
  private readonly router = inject(Router);
  private readonly authState = inject(AuthState);

  private readonly FRIENDSHIPS_KEY = 'ruby_friendships';
  private readonly AUTH_USERS_KEY = 'ruby_auth_users';
  private readonly STATION_PRESENCE_KEY = 'ruby_station_presence';
  private readonly STATIONS_KEY = 'ruby_stations';

  readonly currentUser = this.authState.currentUser;

  readonly searchTerm = signal('');

  readonly friendships = signal<FriendshipItem[]>(
    this.loadStorageArray<FriendshipItem>(this.FRIENDSHIPS_KEY)
  );

  readonly authUsers = signal<AuthUserItem[]>(
    this.loadStorageArray<AuthUserItem>(this.AUTH_USERS_KEY)
  );

  readonly stationPresence = signal<StationPresenceItem[]>(
    this.loadStorageArray<StationPresenceItem>(this.STATION_PRESENCE_KEY)
  );

  readonly stations = signal<StoredStation[]>(
    this.loadStorageArray<StoredStation>(this.STATIONS_KEY)
  );

  readonly activeFriendsInStations = computed<ChatStationFriendItem[]>(() => {
    const currentUser = this.currentUser();
    if (!currentUser?.id) return [];

    const currentUserId = currentUser.id;
    const users = this.authUsers();
    const stations = this.stations();

    const friendshipsForUser = this.friendships().filter(
      friendship =>
        friendship.userAId === currentUserId || friendship.userBId === currentUserId
    );

    return friendshipsForUser
      .map(friendship => {
        const friendUserId =
          friendship.userAId === currentUserId ? friendship.userBId : friendship.userAId;

        const friendUser = users.find(user => user.id === friendUserId);
        const friendPresence = this.stationPresence().find(
          presence => presence.userId === friendUserId
        );

        if (!friendUser || !friendPresence?.stationId) {
          return null;
        }

        const station = stations.find(item => item.id === friendPresence.stationId);
        if (!station) return null;

        return {
          friendshipId: friendship.id,
          friendUserId,
          friendName: friendUser.name,
          friendAvatarUrl: friendUser.avatarUrl ?? null,
          stationId: station.id,
          stationName: station.name,
          enteredAt: friendPresence.enteredAt,
        } satisfies ChatStationFriendItem;
      })
      .filter((item): item is ChatStationFriendItem => item !== null)
      .sort((a, b) => {
        return new Date(b.enteredAt).getTime() - new Date(a.enteredAt).getTime();
      });
  });

  readonly filteredActiveFriends = computed<ChatStationFriendItem[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const items = this.activeFriendsInStations();

    if (!term) return items;

    return items.filter(item =>
      item.friendName.toLowerCase().includes(term) ||
      item.stationName.toLowerCase().includes(term)
    );
  });

  readonly totalActiveFriends = computed(() => this.filteredActiveFriends().length);

  constructor() {
    this.refreshData();
  }

  updateSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  goToFriendStation(item: ChatStationFriendItem): void {
    if (!item.stationId) return;
    this.router.navigate(['/user/station', item.stationId]);
  }

  getFriendAvatar(item: ChatStationFriendItem): string {
    return item.friendAvatarUrl || '/assets/icons/avatar-placeholder.png';
  }

  trackByFriendStation(_: number, item: ChatStationFriendItem): string {
    return `${item.friendshipId}-${item.stationId}`;
  }

  private refreshData(): void {
    this.friendships.set(
      this.loadStorageArray<FriendshipItem>(this.FRIENDSHIPS_KEY)
    );

    this.authUsers.set(
      this.loadStorageArray<AuthUserItem>(this.AUTH_USERS_KEY)
    );

    this.stationPresence.set(
      this.loadStorageArray<StationPresenceItem>(this.STATION_PRESENCE_KEY)
    );

    this.stations.set(
      this.loadStorageArray<StoredStation>(this.STATIONS_KEY)
    );
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