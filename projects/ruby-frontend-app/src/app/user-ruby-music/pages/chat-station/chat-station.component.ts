import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FriendshipStatus } from 'lib-ruby-sdks/social-service';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { FriendsState } from '../../state/friends.state';
import { LibraryState } from '../../state/library.state';

/**
 * Represents an accepted friend with optional station presence info.
 *
 * LIMITATION: Per-user station presence (which station a friend is listening to)
 * requires a dedicated realtime event that is not defined in the current AsyncAPI spec
 * (api-realtime-ws-ms.yml). The spec only exposes `listener_count` (total count per
 * station), not individual user→station mappings.
 *
 * When a "friend_presence" or "station_member_list" event is added to the spec,
 * stationId and stationName can be populated here from a realtime stream.
 */
interface FriendStationItem {
  friendshipId: string;
  friendUserId: string;
  /** null until enriched via UsersApi (pending Batch 5 / UsersApi availability) */
  friendName: string | null;
  /** null until per-user presence event is available in the realtime spec */
  stationId: string | null;
  /** null until per-user presence event is available in the realtime spec */
  stationName: string | null;
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

  readonly currentUser = this.authState.currentUser;
  readonly searchTerm = signal('');

  /**
   * Accepted friends mapped to FriendStationItem.
   * Friend names and station presence data are placeholders until
   * UsersApi and a per-user presence realtime event are available.
   */
  readonly activeFriendsInStations = computed<FriendStationItem[]>(() => {
    const currentUser = this.currentUser();
    if (!currentUser?.id) return [];

    const currentUserId = currentUser.id;

    return this.friendsState.friends()
      .filter(f => f.status === FriendshipStatus.ACCEPTED)
      .flatMap(f => {
        const friendUserId = f.requesterId === currentUserId
          ? (f.addresseeId ?? '')
          : (f.requesterId ?? '');

        if (!friendUserId) return [] as FriendStationItem[];

        const item: FriendStationItem = {
          friendshipId: f.id ?? '',
          friendUserId,
          friendName: null,   // TODO: enrich from UsersApi when endpoint available
          stationId: null,    // TODO: populate from realtime per-user presence event
          stationName: null,  // TODO: populate from realtime per-user presence event
        };
        return [item];
      });
  });

  readonly filteredActiveFriends = computed<FriendStationItem[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const items = this.activeFriendsInStations();
    if (!term) return items;

    return items.filter(item =>
      (item.friendName?.toLowerCase().includes(term) ?? false) ||
      (item.stationName?.toLowerCase().includes(term) ?? false) ||
      item.friendUserId.toLowerCase().includes(term)
    );
  });

  readonly totalActiveFriends = computed(() => this.filteredActiveFriends().length);

  constructor() {
    // Load friends and station catalog on init
    this.friendsState.loadFriends();
    this.libraryState.loadActiveStations();
  }

  updateSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  goToFriendStation(item: FriendStationItem): void {
    if (!item.stationId) return;
    this.router.navigate(['/user/station', item.stationId]);
  }

  getFriendAvatar(_item: FriendStationItem): string {
    // TODO: return friend's avatarUrl once UsersApi enrichment is available
    return '/assets/icons/avatar-placeholder.png';
  }

  trackByFriendStation(_: number, item: FriendStationItem): string {
    return item.friendshipId;
  }
}
