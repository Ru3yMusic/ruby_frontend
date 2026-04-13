import { Injectable, computed, inject, signal } from '@angular/core';
import {
  LibraryApi,
  LibraryItemType,
  PlayHistoryApi,
  PlayHistoryResponse,
  SongInteractionsApi,
} from 'lib-ruby-sdks/interaction-service';

@Injectable({
  providedIn: 'root',
})
export class InteractionState {
  private readonly songInteractionsApi = inject(SongInteractionsApi);
  private readonly playHistoryApi = inject(PlayHistoryApi);
  private readonly libraryApi = inject(LibraryApi);

  /* ===================== */
  /* SIGNALS */
  /* ===================== */

  private readonly _likedSongIds = signal<string[]>([]);
  readonly likedSongIds = this._likedSongIds.asReadonly();

  private readonly _playHistory = signal<PlayHistoryResponse[]>([]);
  readonly playHistory = this._playHistory.asReadonly();

  private readonly _libraryAlbumIds = signal<string[]>([]);
  readonly libraryAlbumIds = this._libraryAlbumIds.asReadonly();

  private readonly _libraryArtistIds = signal<string[]>([]);
  readonly libraryArtistIds = this._libraryArtistIds.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  /* ===================== */
  /* COMPUTED */
  /* ===================== */

  readonly likedSongsCount = computed(() => this._likedSongIds().length);

  isSongLiked(songId: string): boolean {
    return this._likedSongIds().includes(songId);
  }

  isAlbumInLibrary(albumId: string): boolean {
    return this._libraryAlbumIds().includes(albumId);
  }

  isArtistInLibrary(artistId: string): boolean {
    return this._libraryArtistIds().includes(artistId);
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
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading liked songs');
        this._loading.set(false);
      },
    });
  }

  likeSong(songId: string): void {
    this.songInteractionsApi.likeSong(songId).subscribe({
      next: () => {
        this._likedSongIds.update(ids =>
          ids.includes(songId) ? ids : [...ids, songId]
        );
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error liking song');
      },
    });
  }

  unlikeSong(songId: string): void {
    this.songInteractionsApi.unlikeSong(songId).subscribe({
      next: () => {
        this._likedSongIds.update(ids => ids.filter(id => id !== songId));
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error unliking song');
      },
    });
  }

  toggleLike(songId: string): void {
    if (this.isSongLiked(songId)) {
      this.unlikeSong(songId);
    } else {
      this.likeSong(songId);
    }
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
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading library artists');
        this._loading.set(false);
      },
    });
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
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error removing artist from library');
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
