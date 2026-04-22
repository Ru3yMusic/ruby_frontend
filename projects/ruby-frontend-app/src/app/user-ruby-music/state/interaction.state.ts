import { Injectable, computed, inject, signal } from '@angular/core';
import {
  LibraryApi,
  LibraryItemType,
  PlayHistoryApi,
  PlayHistoryResponse,
  SongInteractionsApi,
} from 'lib-ruby-sdks/interaction-service';
import { ArtistFollowsApi } from 'lib-ruby-sdks/social-service';
import { SongResponse } from 'lib-ruby-sdks/catalog-service';
import { AuthState } from '../../ruby-auth-ui/auth/state/auth.state';
import { PlaylistState } from './playlist.state';
import { LibraryState } from './library.state';

@Injectable({
  providedIn: 'root',
})
export class InteractionState {
  private readonly songInteractionsApi = inject(SongInteractionsApi);
  private readonly playHistoryApi = inject(PlayHistoryApi);
  private readonly libraryApi = inject(LibraryApi);
  private readonly artistFollowsApi = inject(ArtistFollowsApi);
  private readonly authState = inject(AuthState);
  private readonly playlistState = inject(PlaylistState);
  private readonly libraryState = inject(LibraryState);

  /* ===================== */
  /* SIGNALS */
  /* ===================== */

  private readonly _likedSongIds = signal<string[]>([]);
  readonly likedSongIds = this._likedSongIds.asReadonly();

  // Delta local sobre likesCount estático de cada SongResponse.
  // Se actualiza solo tras el next de like/unlike (sin optimistic).
  // Permite que vistas con SongResponse cacheado (station-detail) muestren el contador al instante.
  private readonly _likesCountDeltaBySongId = signal<Record<string, number>>({});

  private readonly _playHistory = signal<PlayHistoryResponse[]>([]);
  readonly playHistory = this._playHistory.asReadonly();

  private readonly _libraryAlbumIds = signal<string[]>([]);
  readonly libraryAlbumIds = this._libraryAlbumIds.asReadonly();

  private readonly _libraryArtistIds = signal<string[]>([]);
  readonly libraryArtistIds = this._libraryArtistIds.asReadonly();

  private readonly _followedArtistIds = signal<string[]>([]);
  readonly followedArtistIds = this._followedArtistIds.asReadonly();

  /**
   * Distinguishes "not loaded yet" from "user follows nobody" (both leave the
   * arrays empty). Consumers that need to exclude followed items (e.g. Home's
   * recommended-artists section) must wait for this flag before filtering,
   * otherwise on F5 the filter runs against an empty set and leaks followed
   * artists into the recommendations.
   */
  private readonly _followsLoaded = signal(false);
  readonly followsLoaded = this._followsLoaded.asReadonly();

  /**
   * Same rationale as `_followsLoaded` but for liked songs and library albums.
   * user-layout uses these flags to hydrate the whole interaction catalog on
   * any /user/** F5 — otherwise heart icons in album-detail / artist-detail /
   * playlist-detail / right-panel / top-header search render in "outline" state
   * on first paint because those pages never call the loaders themselves.
   */
  private readonly _likedSongsLoaded = signal(false);
  readonly likedSongsLoaded = this._likedSongsLoaded.asReadonly();

  private readonly _libraryAlbumsLoaded = signal(false);
  readonly libraryAlbumsLoaded = this._libraryAlbumsLoaded.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  /* ===================== */
  /* COMPUTED */
  /* ===================== */

  readonly likedSongsCount = computed(() => this._likedSongIds().length);

  /**
   * Fuente de verdad unificada para "artistas seguidos": unión de la biblioteca
   * interna (interaction-service) y los follows reales (social-service). Cualquier
   * artista presente en una sola de las fuentes (caso legacy o divergencia
   * transitoria) se refleja como seguido. Library / profile / carruseles leen
   * esta lista para que todas las vistas muestren el mismo conjunto.
   */
  readonly allFollowedArtistIds = computed(() => {
    const union = new Set<string>([
      ...this._libraryArtistIds(),
      ...this._followedArtistIds(),
    ]);
    return Array.from(union);
  });

  isSongLiked(songId: string): boolean {
    return this._likedSongIds().includes(songId);
  }

  getLikesCountDelta(songId: string): number {
    return this._likesCountDeltaBySongId()[songId] ?? 0;
  }

  isAlbumInLibrary(albumId: string): boolean {
    return this._libraryAlbumIds().includes(albumId);
  }

  isArtistInLibrary(artistId: string): boolean {
    return this._libraryArtistIds().includes(artistId)
      || this._followedArtistIds().includes(artistId);
  }

  /* ===================== */
  /* LIKES */
  /* ===================== */

  loadLikedSongs(): void {
    this._loading.set(true);
    this._error.set(null);
    this.songInteractionsApi.getLikedSongs().subscribe({
      next: (page) => {
        this._likedSongIds.set(page.content ?? []);
        this._likedSongsLoaded.set(true);
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading liked songs');
        this._loading.set(false);
      },
    });
  }

  likeSong(songId: string, song?: SongResponse): void {
    this.songInteractionsApi.likeSong(songId).subscribe({
      next: () => {
        const wasLiked = this._likedSongIds().includes(songId);
        this._likedSongIds.update(ids =>
          ids.includes(songId) ? ids : [...ids, songId]
        );
        if (!wasLiked) {
          this._likesCountDeltaBySongId.update(map => ({
            ...map,
            [songId]: (map[songId] ?? 0) + 1,
          }));
          // Si la vista pasó el SongResponse completo, lo sembramos en el caché
          // global para que playlist-detail pueda renderizar la fila al instante.
          if (song) {
            this.libraryState.upsertSongs([song]);
          }
          const userId = this.authState.currentUser()?.id;
          if (userId) {
            this.playlistState.syncLikedSong(userId, songId, 'added');
          }
        }
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error liking song');
      },
    });
  }

  unlikeSong(songId: string): void {
    this.songInteractionsApi.unlikeSong(songId).subscribe({
      next: () => {
        const wasLiked = this._likedSongIds().includes(songId);
        this._likedSongIds.update(ids => ids.filter(id => id !== songId));
        if (wasLiked) {
          this._likesCountDeltaBySongId.update(map => ({
            ...map,
            [songId]: (map[songId] ?? 0) - 1,
          }));
          const userId = this.authState.currentUser()?.id;
          if (userId) {
            this.playlistState.syncLikedSong(userId, songId, 'removed');
          }
        }
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error unliking song');
      },
    });
  }

  toggleLike(songId: string, song?: SongResponse): void {
    if (this.isSongLiked(songId)) {
      this.unlikeSong(songId);
    } else {
      this.likeSong(songId, song);
    }
  }

  /**
   * Applies a realtime like-count delta coming from ANOTHER user in the same
   * station room (WS `like_delta`). Only updates the counter — NOT the local
   * user's `_likedSongIds`, because the heart state is per-user and this
   * delta came from someone else.
   */
  applyRemoteLikeDelta(songId: string, delta: 1 | -1): void {
    if (!songId) return;
    this._likesCountDeltaBySongId.update((map) => ({
      ...map,
      [songId]: (map[songId] ?? 0) + delta,
    }));
  }

  /* ===================== */
  /* PLAY HISTORY */
  /* ===================== */

  loadPlayHistory(): void {
    this._loading.set(true);
    this._error.set(null);
    this.playHistoryApi.getPlayHistory().subscribe({
      next: (page) => {
        this._playHistory.set(page.content ?? []);
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading play history');
        this._loading.set(false);
      },
    });
  }

  recordPlay(songId: string): void {
    this.playHistoryApi.recordPlay({ songId, durationPlayedSeconds: 0 }).subscribe({
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error recording play');
      },
    });
  }

  /* ===================== */
  /* LIBRARY (Albums/Artists) */
  /* ===================== */

  loadLibraryAlbums(): void {
    this._loading.set(true);
    this._error.set(null);
    this.libraryApi.getLibrary(LibraryItemType.ALBUM).subscribe({
      next: (page) => {
        this._libraryAlbumIds.set(page.content ?? []);
        this._libraryAlbumsLoaded.set(true);
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading library albums');
        this._loading.set(false);
      },
    });
  }

  loadLibraryArtists(): void {
    this._loading.set(true);
    this._error.set(null);
    this.libraryApi.getLibrary(LibraryItemType.ARTIST).subscribe({
      next: (page) => {
        this._libraryArtistIds.set(page.content ?? []);
        this._followsLoaded.set(true);
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading library artists');
        this._loading.set(false);
      },
    });
    // Cargar en paralelo los follows reales del social-service para que
    // ambas fuentes queden disponibles tras un solo bootstrap.
    this.loadFollowedArtists();
  }

  addAlbumToLibrary(albumId: string): void {
    this.libraryApi.addToLibrary({ type: LibraryItemType.ALBUM, itemId: albumId }).subscribe({
      next: () => {
        this._libraryAlbumIds.update(ids =>
          ids.includes(albumId) ? ids : [...ids, albumId]
        );
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error adding album to library');
      },
    });
  }

  removeAlbumFromLibrary(albumId: string): void {
    this.libraryApi.removeFromLibrary(LibraryItemType.ALBUM, albumId).subscribe({
      next: () => {
        this._libraryAlbumIds.update(ids => ids.filter(id => id !== albumId));
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error removing album from library');
      },
    });
  }

  addArtistToLibrary(artistId: string): void {
    this.libraryApi.addToLibrary({ type: LibraryItemType.ARTIST, itemId: artistId }).subscribe({
      next: () => {
        this._libraryArtistIds.update(ids =>
          ids.includes(artistId) ? ids : [...ids, artistId]
        );
        // Propagar follow real al social-service (idempotente) para incrementar
        // followersCount en catalog vía Kafka. Falla aislada: si el follow falla
        // no revertimos la library — quedan como operaciones independientes.
        this.artistFollowsApi.followArtist(artistId).subscribe({
          next: () => {
            this._followedArtistIds.update(ids =>
              ids.includes(artistId) ? ids : [...ids, artistId]
            );
          },
          error: (err: { message?: string }) => {
            this._error.set(err?.message ?? 'Error following artist');
          },
        });
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error adding artist to library');
      },
    });
  }

  removeArtistFromLibrary(artistId: string): void {
    this.libraryApi.removeFromLibrary(LibraryItemType.ARTIST, artistId).subscribe({
      next: () => {
        this._libraryArtistIds.update(ids => ids.filter(id => id !== artistId));
        // Propagar unfollow al social-service (idempotente) para decrementar
        // followersCount en catalog vía Kafka.
        this.artistFollowsApi.unfollowArtist(artistId).subscribe({
          next: () => {
            this._followedArtistIds.update(ids => ids.filter(id => id !== artistId));
          },
          error: (err: { message?: string }) => {
            this._error.set(err?.message ?? 'Error unfollowing artist');
          },
        });
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error removing artist from library');
      },
    });
  }

  /* ===================== */
  /* ARTIST FOLLOWS */
  /* ===================== */

  isArtistFollowed(artistId: string): boolean {
    return this._libraryArtistIds().includes(artistId)
      || this._followedArtistIds().includes(artistId);
  }

  loadFollowedArtists(): void {
    this._loading.set(true);
    this._error.set(null);
    this.artistFollowsApi.getFollowedArtists().subscribe({
      next: (ids) => {
        this._followedArtistIds.set(ids);
        this._followsLoaded.set(true);
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading followed artists');
        this._loading.set(false);
      },
    });
  }

  followArtist(artistId: string): void {
    // Optimistic update — add immediately, revert on error
    this._followedArtistIds.update(ids =>
      ids.includes(artistId) ? ids : [...ids, artistId]
    );
    this.artistFollowsApi.followArtist(artistId).subscribe({
      next: () => {
        // Mantener library sincronizada (idempotente a nivel backend).
        this.libraryApi.addToLibrary({ type: LibraryItemType.ARTIST, itemId: artistId }).subscribe({
          next: () => {
            this._libraryArtistIds.update(ids =>
              ids.includes(artistId) ? ids : [...ids, artistId]
            );
          },
          error: (err: { message?: string }) => {
            this._error.set(err?.message ?? 'Error adding artist to library');
          },
        });
      },
      error: (err: { message?: string }) => {
        this._followedArtistIds.update(ids => ids.filter(id => id !== artistId));
        this._error.set(err?.message ?? 'Error following artist');
      },
    });
  }

  unfollowArtist(artistId: string): void {
    // Optimistic update — remove immediately, revert on error
    const previous = this._followedArtistIds();
    this._followedArtistIds.update(ids => ids.filter(id => id !== artistId));
    this.artistFollowsApi.unfollowArtist(artistId).subscribe({
      next: () => {
        // Mantener library sincronizada.
        this.libraryApi.removeFromLibrary(LibraryItemType.ARTIST, artistId).subscribe({
          next: () => {
            this._libraryArtistIds.update(ids => ids.filter(id => id !== artistId));
          },
          error: (err: { message?: string }) => {
            this._error.set(err?.message ?? 'Error removing artist from library');
          },
        });
      },
      error: (err: { message?: string }) => {
        this._followedArtistIds.set(previous);
        this._error.set(err?.message ?? 'Error unfollowing artist');
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
