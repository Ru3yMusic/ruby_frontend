import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FriendshipStatus } from 'lib-ruby-sdks/social-service';
import { UsersApi, UserResponse } from 'lib-ruby-sdks/auth-service';
import { BulkPresenceResult, RealtimePort } from 'lib-ruby-core';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { FriendsState } from '../../state/friends.state';
import { LibraryState } from '../../state/library.state';

/**
 * Represents an accepted friend enriched with presence, name, avatar, and station info.
 * Populated asynchronously on page init via getBulkPresence + batchGetUsers.
 */
interface FriendStationItem {
  friendshipId: string;
  friendUserId: string;
  /** Friend's display name from UsersApi (fallback: userId when API unavailable). */
  friendName: string;
  /** Friend's profile photo URL from UsersApi (null if unavailable). */
  friendAvatarUrl: string | null;
  /**
   * Friend's current station ID — only set if online AND station exists in LibraryState.
   * null means offline, not in a station, or station unknown (hides Escuchar button).
   */
  stationId: string | null;
  /**
   * Resolved station name from LibraryState lookup.
   * null if offline or not in a station.
   * 'En una estación oculta' if stationId from presence was not found in LibraryState.
   */
  stationName: string | null;
  /** Whether the friend is currently online per bulk presence response. */
  isOnline: boolean;
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
  private readonly friendsState = inject(FriendsState);
  private readonly libraryState = inject(LibraryState);
  private readonly realtimePort = inject(RealtimePort);
  private readonly usersApi = inject(UsersApi);

  readonly currentUser = this.authState.currentUser;
  readonly searchTerm = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private readonly _enrichedFriends = signal<FriendStationItem[]>([]);

  readonly filteredActiveFriends = computed<FriendStationItem[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const items = this._enrichedFriends();
    if (!term) return items;

    return items.filter(item =>
      item.friendName.toLowerCase().includes(term) ||
      (item.stationName?.toLowerCase().includes(term) ?? false) ||
      item.friendUserId.toLowerCase().includes(term)
    );
  });

  readonly totalActiveFriends = computed(() => this.filteredActiveFriends().length);

  constructor() {
    this.friendsState.loadFriends();
    this.libraryState.loadActiveStations();

    // Runs when currentUser, friends signal, or stations signal changes.
    // Stations are tracked so the effect re-runs once they load, resolving names correctly.
    effect(() => {
      const currentUser = this.currentUser();
      if (!currentUser?.id) return;

      const allFriends = this.friendsState.friends();
      const stations = this.libraryState.stations(); // tracked dependency
      const acceptedFriends = allFriends.filter(
        f => f.status === FriendshipStatus.ACCEPTED
      );

      // Short-circuit: no accepted friends — skip API calls, show empty state
      if (acceptedFriends.length === 0) {
        this._enrichedFriends.set([]);
        this.loading.set(false);
        return;
      }

      const currentUserId = currentUser.id;
      const friendIds = acceptedFriends
        .map(f =>
          f.requesterId === currentUserId
            ? (f.addresseeId ?? '')
            : (f.requesterId ?? '')
        )
        .filter(id => id.length > 0);

      if (friendIds.length === 0) {
        this._enrichedFriends.set([]);
        this.loading.set(false);
        return;
      }

      this.loading.set(true);
      this.error.set(null);

      forkJoin({
        presence: this.realtimePort.getBulkPresence(friendIds).pipe(
          catchError(() => of({} as BulkPresenceResult))
        ),
        users: this.usersApi.batchGetUsers({ ids: friendIds }).pipe(
          catchError(() => of([] as UserResponse[]))
        ),
      }).subscribe({
        next: ({ presence, users }) => {
          const userMap = new Map(users.map(u => [u.id!, u]));

          const enriched: FriendStationItem[] = acceptedFriends.flatMap(f => {
            const friendUserId =
              f.requesterId === currentUserId
                ? (f.addresseeId ?? '')
                : (f.requesterId ?? '');
            if (!friendUserId) return [];

            const presenceInfo = presence[friendUserId];
            const userInfo = userMap.get(friendUserId);
            const rawStationId = presenceInfo?.station_id ?? null;

            // Only expose stationId when found in LibraryState — unknown stations
            // hide the Escuchar button to prevent navigation to non-existent routes
            const station = rawStationId
              ? stations.find(s => s.id === rawStationId)
              : undefined;

            return [{
              friendshipId: f.id ?? '',
              friendUserId,
              friendName: userInfo?.displayName ?? friendUserId,
              friendAvatarUrl: userInfo?.profilePhotoUrl ?? null,
              isOnline: presenceInfo?.online ?? false,
              stationId: station?.id ?? null,
              stationName: station?.name
                ?? (rawStationId ? 'En una estación oculta' : null),
            }];
          });

          this._enrichedFriends.set(enriched);
          this.loading.set(false);
        },
        error: (err: { message?: string }) => {
          // Graceful degradation: show all friends as offline, do not crash
          const fallback: FriendStationItem[] = acceptedFriends.flatMap(f => {
            const friendUserId =
              f.requesterId === currentUserId
                ? (f.addresseeId ?? '')
                : (f.requesterId ?? '');
            if (!friendUserId) return [];
            return [{
              friendshipId: f.id ?? '',
              friendUserId,
              friendName: friendUserId,
              friendAvatarUrl: null,
              isOnline: false,
              stationId: null,
              stationName: null,
            }];
          });

          this._enrichedFriends.set(fallback);
          this.error.set(err?.message ?? 'Error al cargar presencia de amigos');
          this.loading.set(false);
        },
      });
    });
  }

  updateSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  goToFriendStation(item: FriendStationItem): void {
    if (!item.stationId) return;
    this.router.navigate(['/user/station', item.stationId]);
  }

  getFriendAvatar(item: FriendStationItem): string {
    return item.friendAvatarUrl ?? '/assets/icons/avatar-placeholder.png';
  }

  trackByFriendStation(_: number, item: FriendStationItem): string {
    return item.friendshipId;
  }
}
