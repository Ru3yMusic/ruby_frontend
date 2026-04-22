import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
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
  private readonly usersApi = inject(UsersApi);
  private readonly destroyRef = inject(DestroyRef);

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
    // Ensure the friend list and station catalog are available even when the
    // user boots straight into /user/home — the toast filter needs both.
    this.friendsState.loadFriends();
    this.libraryState.loadActiveStations();

    // Global catalog preload — guarantees that any /user/** route (including
    // direct F5 into artist-detail, album-detail, playlist-detail) finds
    // `libraryState.songs/artists/albums` already populated so its computeds
    // (currentArtist, currentAlbum, recommended lists, etc.) resolve instead
    // of sitting on the empty-initial-value branch. Gated by empty checks so
    // page-level loaders that already fired are not re-triggered.
    if (this.libraryState.songs().length === 0) {
      this.libraryState.loadRecentSongs();
    }
    if (this.libraryState.artists().length === 0) {
      this.libraryState.loadArtists();
    }
    if (this.libraryState.albums().length === 0) {
      this.libraryState.loadNewReleases();
    }

    // Interaction catalog: library artists + followed artists. Required by
    // any /user/** page that shows "is the user following this artist?" or
    // lists followed artists (Profile's Siguiendo, Home's Artistas
    // recomendados filter, etc.). Gated by `followsLoaded` so users who
    // follow nobody don't re-fire the HTTP on every layout mount — that
    // flag is set to true the moment either loader resolves, even when the
    // returned list is empty. `loadLibraryArtists` internally also calls
    // `loadFollowedArtists`, so one call seeds both sources.
    if (!this.interactionState.followsLoaded()) {
      this.interactionState.loadLibraryArtists();
    }

    // Liked songs + library albums: same pattern. Pages like album-detail,
    // artist-detail, playlist-detail, song-detail, the right-panel and the
    // top-header search all read `isSongLiked` / `isAlbumInLibrary` without
    // ever loading the sets themselves. Preloading here guarantees heart
    // icons and "Guardado" badges render in the correct state on any F5 into
    // /user/**, not only when the user happens to land on home/library/
    // station-detail first. Guards avoid re-firing on every route change.
    if (!this.interactionState.likedSongsLoaded()) {
      this.interactionState.loadLikedSongs();
    }
    if (!this.interactionState.libraryAlbumsLoaded()) {
      this.interactionState.loadLibraryAlbums();
    }

    this.realtimePort
      .onUserPresenceChanged()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload) => this.handlePresenceChange(payload));
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
