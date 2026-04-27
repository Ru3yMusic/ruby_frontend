import { DestroyRef, Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AlbumResponse,
  AlbumsApi,
  ArtistResponse,
  ArtistsApi,
} from 'lib-ruby-sdks/catalog-service';
import {
  PlaylistResponse,
  PlaylistsApi,
} from 'lib-ruby-sdks/playlist-service';
import {
  MusicFeedAlbumReleasedPayload,
  MusicFeedArtistTopChangedPayload,
  MusicFeedPlaylistDeletedPayload,
  MusicFeedPlaylistPrivacyChangedPayload,
  MusicFeedPlaylistPublicCreatedPayload,
  RealtimePort,
} from 'lib-ruby-core';
import { AuthState } from '../../ruby-auth-ui/auth/state/auth.state';

/**
 * Page-scoped state for the realtime music feed in `/user/music`.
 *
 * IMPORTANT — page-scoping:
 * This service is provided in MusicComponent.providers (NOT providedIn:'root')
 * so its lifecycle is bound to that route. When the user navigates away, the
 * component is destroyed, this state is destroyed, and all WS subscriptions
 * are torn down via takeUntilDestroyed. This is what guarantees that the
 * cap+replace logic NEVER bleeds into other pages.
 *
 * Flow:
 *  1. Constructor fires the 3 initial HTTP fetches (top-artists,
 *     public-playlists, new-releases) to seed each signal.
 *  2. Constructor subscribes to the 5 music_feed_* streams from RealtimePort.
 *  3. Each stream applies its own cap+replace rule, capped at FEED_CAP=5.
 *
 * Cap+replace semantics (per section):
 *  - new public/top item arrives → prepend to head, slice(0, FEED_CAP).
 *    The OLDEST item falls off the tail. ONLY visible in /user/music.
 *  - existing item goes private/non-top/deleted → remove by id (no fallback).
 */
const FEED_CAP = 5;

@Injectable()
export class MusicFeedState {
  private readonly albumsApi = inject(AlbumsApi);
  private readonly artistsApi = inject(ArtistsApi);
  private readonly playlistsApi = inject(PlaylistsApi);
  private readonly realtime = inject(RealtimePort);
  private readonly authState = inject(AuthState);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _recentReleases = signal<AlbumResponse[]>([]);
  readonly recentReleases = this._recentReleases.asReadonly();

  private readonly _topArtists = signal<ArtistResponse[]>([]);
  readonly topArtists = this._topArtists.asReadonly();

  private readonly _recommendedPlaylists = signal<PlaylistResponse[]>([]);
  readonly recommendedPlaylists = this._recommendedPlaylists.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  readonly hasAnyContent = computed(
    () =>
      this._recentReleases().length > 0 ||
      this._topArtists().length > 0 ||
      this._recommendedPlaylists().length > 0,
  );

  constructor() {
    this.fetchInitialFeed();
    this.subscribeToRealtime();
  }

  // ─── Initial fetch ────────────────────────────────────────────────────────

  private fetchInitialFeed(): void {
    this._loading.set(true);
    let pending = 3;
    const done = () => {
      pending -= 1;
      if (pending === 0) this._loading.set(false);
    };

    this.albumsApi
      .getNewReleases(0, FEED_CAP)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => this._recentReleases.set(page.content ?? []),
        error: () => this._recentReleases.set([]),
        complete: done,
      });

    this.artistsApi
      .getTopArtists()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list =>
          this._topArtists.set(
            this.sortByCreatedAtDesc(list ?? []).slice(0, FEED_CAP),
          ),
        error: () => this._topArtists.set([]),
        complete: done,
      });

    // Fetch a slightly larger page to leave room after filtering out
    // the current user's own playlists (the user already sees those in
    // their library; surfacing them here would be redundant).
    this.playlistsApi
      .getPublicPlaylists(0, FEED_CAP * 2)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => {
          const all = page.content ?? [];
          const others = all.filter(p => !this.isOwnedByCurrentUser(p.userId));
          this._recommendedPlaylists.set(others.slice(0, FEED_CAP));
        },
        error: () => this._recommendedPlaylists.set([]),
        complete: done,
      });
  }

  // ─── Realtime subscriptions ──────────────────────────────────────────────

  private subscribeToRealtime(): void {
    this.realtime
      .onMusicFeedAlbumReleased()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(p => this.handleAlbumReleased(p));

    this.realtime
      .onMusicFeedArtistTopChanged()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(p => this.handleArtistTopChanged(p));

    this.realtime
      .onMusicFeedPlaylistPublicCreated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(p => this.handlePlaylistPublicCreated(p));

    this.realtime
      .onMusicFeedPlaylistPrivacyChanged()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(p => this.handlePlaylistPrivacyChanged(p));

    this.realtime
      .onMusicFeedPlaylistDeleted()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(p => this.handlePlaylistDeleted(p));
  }

  // ─── Event handlers (cap+replace) ────────────────────────────────────────

  private handleAlbumReleased(p: MusicFeedAlbumReleasedPayload): void {
    const album: AlbumResponse = {
      id: p.albumId,
      title: p.title,
      artist: { id: p.artistId, name: p.artistName },
      coverUrl: p.coverUrl,
      releaseDateTime: p.releaseDateTime,
      released: true,
    };
    this.prependCappedById(this._recentReleases, album);
  }

  private handleArtistTopChanged(p: MusicFeedArtistTopChangedPayload): void {
    if (p.isTop) {
      const artist: ArtistResponse = {
        id: p.artistId,
        name: p.name,
        photoUrl: p.photoUrl,
        isTop: true,
        createdAt: p.createdAt,
      };
      this.prependCappedById(this._topArtists, artist);
    } else {
      this.removeById(this._topArtists, p.artistId);
    }
  }

  private handlePlaylistPublicCreated(
    p: MusicFeedPlaylistPublicCreatedPayload,
  ): void {
    if (this.isOwnedByCurrentUser(p.userId)) return;
    const playlist: PlaylistResponse = {
      id: p.playlistId,
      userId: p.userId,
      name: p.name,
      description: p.description ?? undefined,
      coverUrl: p.coverUrl ?? undefined,
      isPublic: true,
      songCount: p.songCount,
      createdAt: p.createdAt,
    };
    this.prependCappedById(this._recommendedPlaylists, playlist);
  }

  private handlePlaylistPrivacyChanged(
    p: MusicFeedPlaylistPrivacyChangedPayload,
  ): void {
    if (p.isPublic) {
      if (this.isOwnedByCurrentUser(p.userId)) return;
      const playlist: PlaylistResponse = {
        id: p.playlistId,
        userId: p.userId,
        name: p.name,
        description: p.description ?? undefined,
        coverUrl: p.coverUrl ?? undefined,
        isPublic: true,
        songCount: p.songCount,
        createdAt: p.createdAt,
      };
      this.prependCappedById(this._recommendedPlaylists, playlist);
    } else {
      this.removeById(this._recommendedPlaylists, p.playlistId);
    }
  }

  private handlePlaylistDeleted(p: MusicFeedPlaylistDeletedPayload): void {
    this.removeById(this._recommendedPlaylists, p.playlistId);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Insert at head, dedupe by id, cap to FEED_CAP. The oldest (tail) item
   * falls off when capacity is reached — that fall-off is what implements
   * the page-scoped "remove the oldest" rule the user asked for.
   */
  private prependCappedById<T extends { id?: string }>(
    target: WritableSignal<T[]>,
    item: T,
  ): void {
    if (!item.id) return;
    const current = target();
    const filtered = current.filter(x => x.id !== item.id);
    target.set([item, ...filtered].slice(0, FEED_CAP));
  }

  private removeById<T extends { id?: string }>(
    target: WritableSignal<T[]>,
    id: string | undefined,
  ): void {
    if (!id) return;
    target.set(target().filter(x => x.id !== id));
  }

  /**
   * The "Playlists Recomendadas" section is meant to surface OTHER users'
   * public playlists. The current user's own playlists are excluded here
   * because they're already accessible from `/user/library`.
   */
  private isOwnedByCurrentUser(userId: string | undefined): boolean {
    if (!userId) return false;
    const me = this.authState.currentUser()?.id;
    return !!me && me === userId;
  }

  private sortByCreatedAtDesc(artists: ArtistResponse[]): ArtistResponse[] {
    return [...artists].sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
      return bTime - aTime;
    });
  }
}
