import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { catchError, of } from 'rxjs';
import { RealtimePort, WsUserPresenceChangedPayload } from 'lib-ruby-core';
import { FriendshipStatus } from 'lib-ruby-sdks/social-service';
import { UsersApi } from 'lib-ruby-sdks/auth-service';
import { LeftSidebarComponent } from '../../components/left-sidebar/left-sidebar.component';
import { TopHeaderComponent } from '../../components/top-header/top-header.component';
import { FooterPlayerComponent } from '../../components/footer-player/footer-player.component';
import { RightPanelComponent } from '../../components/right-panel/right-panel.component';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { FriendsState } from '../../state/friends.state';
import { LibraryState } from '../../state/library.state';
import { InteractionState } from '../../state/interaction.state';
import { SavedPlaylistsState } from '../../state/saved-playlists.state';

/**
 * Hosts the global "friend entered a station" toast. The listener lives here
 * (not inside ChatStationComponent) so the toast pops up on every /user/**
 * route — home, library, station-detail, anywhere — matching how a real
 * push-notification should behave.
 *
 * The Activos estación screen keeps patching its own card list locally; only
 * the toast piece was moved. This keeps things DRY: one realtime listener per
 * page that needs card updates, plus this layout-level listener for the toast.
 */
@Component({
  selector: 'app-user-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterOutlet,
    LeftSidebarComponent,
    TopHeaderComponent,
    RightPanelComponent,
    FooterPlayerComponent,
  ],
  templateUrl: './user-layout.component.html',
  styleUrls: ['./user-layout.component.scss'],
})
export class UserLayoutComponent implements OnInit {
  private readonly realtimePort = inject(RealtimePort);
  private readonly authState = inject(AuthState);
  private readonly friendsState = inject(FriendsState);
  private readonly libraryState = inject(LibraryState);
  private readonly interactionState = inject(InteractionState);
  private readonly savedPlaylistsState = inject(SavedPlaylistsState);
  private readonly usersApi = inject(UsersApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  /**
   * Matches `/user/station/:id` (live station) — NOT `/user/station` (listing).
   * Drives `[class.player--hidden]` on the footer wrapper so the entire 90px
   * black bar disappears when the user enters a live station, leaving only
   * the chat + station audio. The listing page keeps the footer visible.
   */
  private static readonly LIVE_STATION_ROUTE_REGEX = /^\/user\/station\/[^/]+/;
  readonly isLiveStation = signal(
    UserLayoutComponent.LIVE_STATION_ROUTE_REGEX.test(this.router.url),
  );

  readonly toastMessage = signal('');
  readonly isToastVisible = signal(false);
  /** Drives the slide-up exit animation (mirrors chat-station styling). */
  readonly isToastLeaving = signal(false);

  /** Last known stationId per friend — used to detect a null → station jump. */
  private readonly friendStationMap = new Map<string, string | null>();
  /** Dedupe: same friend+station won't fire twice within 10 s (WS reconnects echo). */
  private readonly lastToastKey = new Map<string, number>();
  /** One-off lookup cache so we don't hit UsersApi per toast. */
  private readonly friendNameCache = new Map<string, string>();

  private toastHideHandle: ReturnType<typeof setTimeout> | null = null;
  private toastClearHandle: ReturnType<typeof setTimeout> | null = null;

  private static readonly TOAST_VISIBLE_MS = 4_000;
  private static readonly TOAST_LEAVE_ANIM_MS = 260;

  ngOnInit(): void {
    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.isLiveStation.set(
            UserLayoutComponent.LIVE_STATION_ROUTE_REGEX.test(event.urlAfterRedirects),
          );
        }
      });

    this.friendsState.loadFriends();
    this.libraryState.loadActiveStations();
    if (this.libraryState.songs().length === 0) {
      this.libraryState.loadRecentSongs();
    }
    if (this.libraryState.artists().length === 0) {
      this.libraryState.loadArtists();
    }
    setTimeout(() => {
      if (this.libraryState.albums().length === 0) {
        this.libraryState.loadNewReleases();
      }
      if (!this.interactionState.followsLoaded()) {
        this.interactionState.loadLibraryArtists();
      }
      if (!this.interactionState.likedSongsLoaded()) {
        this.interactionState.loadLikedSongs();
      }
      if (!this.interactionState.libraryAlbumsLoaded()) {
        this.interactionState.loadLibraryAlbums();
      }
      this.savedPlaylistsState.loadSavedPlaylists();
    }, 150);
    this.realtimePort
      .onUserPresenceChanged()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload) => this.handlePresenceChange(payload));

    // Cross-user catalog stats — broadcast globally by realtime-ws-ms when any
    // user (not just this one) follows / unfollows an artist or plays a song.
    // We mutate the LOCAL cache in-place so UI bindings (followers count,
    // play count) reflect the new value live without polling catalog-service.
    this.realtimePort
      .onArtistFollowersChanged()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ artistId, delta }) => {
        this.libraryState.applyArtistFollowersDelta(artistId, delta);
      });

    this.realtimePort
      .onSongPlayCountChanged()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ songId, delta }) => {
        this.libraryState.applySongPlayCountDelta(songId, delta);
      });
  }

  private handlePresenceChange(payload: WsUserPresenceChangedPayload): void {
    const me = this.authState.currentUser()?.id;
    if (!me) return;

    const isAcceptedFriend = this.friendsState.friends().some((f) => {
      if (f.status !== FriendshipStatus.ACCEPTED) return false;
      const other = f.requesterId === me ? f.addresseeId : f.requesterId;
      return other === payload.userId;
    });
    if (!isAcceptedFriend) return;

    const prev = this.friendStationMap.get(payload.userId) ?? null;
    this.friendStationMap.set(payload.userId, payload.stationId ?? null);

    // Only fire on a null → station transition (entering). Leave / disconnect
    // / station-to-station transitions don't produce this toast.
    const justEnteredStation = !prev && !!payload.stationId;
    if (!justEnteredStation) return;

    const station = this.libraryState
      .stations()
      .find((s) => s.id === payload.stationId);
    if (!station?.name) return;

    const key = `${payload.userId}:${payload.stationId}`;
    const now = Date.now();
    if ((this.lastToastKey.get(key) ?? 0) + 10_000 > now) return;
    this.lastToastKey.set(key, now);

    const cachedName = this.friendNameCache.get(payload.userId);
    if (cachedName) {
      this.showToast(
        `@${cachedName} está escuchando la estación ${station.name} ahora mismo.`,
      );
      return;
    }

    this.usersApi
      .getUserById(payload.userId)
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((user) => {
        const name = user?.displayName || payload.userId;
        this.friendNameCache.set(payload.userId, name);
        this.showToast(
          `@${name} está escuchando la estación ${station.name} ahora mismo.`,
        );
      });
  }

  private showToast(message: string): void {
    if (this.toastHideHandle !== null) clearTimeout(this.toastHideHandle);
    if (this.toastClearHandle !== null) clearTimeout(this.toastClearHandle);

    this.toastMessage.set(message);
    this.isToastLeaving.set(false);
    this.isToastVisible.set(true);

    this.toastHideHandle = setTimeout(() => {
      this.isToastLeaving.set(true);
      this.toastClearHandle = setTimeout(() => {
        this.isToastVisible.set(false);
        this.isToastLeaving.set(false);
        this.toastMessage.set('');
      }, UserLayoutComponent.TOAST_LEAVE_ANIM_MS);
    }, UserLayoutComponent.TOAST_VISIBLE_MS);
  }
}
