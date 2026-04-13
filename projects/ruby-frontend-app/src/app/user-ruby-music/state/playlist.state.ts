import { Injectable, computed, inject, signal } from '@angular/core';
import {
  PlaylistsApi,
  PlaylistSongsApi,
  PlaylistResponse,
  PlaylistSongResponse,
  CreatePlaylistRequest,
  UpdatePlaylistRequest,
} from 'lib-ruby-sdks/playlist-service';

@Injectable({
  providedIn: 'root',
})
export class PlaylistState {
  private readonly playlistsApi = inject(PlaylistsApi);
  private readonly playlistSongsApi = inject(PlaylistSongsApi);

  /* ===================== */
  /* SIGNALS */
  /* ===================== */

  private readonly _playlists = signal<PlaylistResponse[]>([]);
  readonly playlists = this._playlists.asReadonly();

  private readonly _currentPlaylistSongs = signal<PlaylistSongResponse[]>([]);
  readonly currentPlaylistSongs = this._currentPlaylistSongs.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  /* ===================== */
  /* COMPUTED */
  /* ===================== */

  readonly totalPlaylists = computed(() => this._playlists().length);

  /* ===================== */
  /* LOAD */
  /* ===================== */

  loadPlaylists(): void {
    this._loading.set(true);
    this._error.set(null);
    this.playlistsApi.getMyPlaylists().subscribe({
      next: (playlists) => {
        this._playlists.set(playlists);
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading playlists');
        this._loading.set(false);
      },
    });
  }

  loadPlaylistSongs(playlistId: string): void {
    this._loading.set(true);
    this._error.set(null);
    this.playlistSongsApi.getPlaylistSongs(playlistId).subscribe({
      next: (songs) => {
        this._currentPlaylistSongs.set(songs);
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading playlist songs');
        this._loading.set(false);
      },
    });
  }

  /* ===================== */
  /* GETTERS */
  /* ===================== */

  getPlaylistsByUser(userId: string): PlaylistResponse[] {
    return this._playlists().filter(p => p.userId === userId);
  }

  getPublicPlaylistsByUser(userId: string): PlaylistResponse[] {
    return this._playlists().filter(p => p.userId === userId && p.isPublic === true);
  }

  getCustomPlaylistsByUser(userId: string): PlaylistResponse[] {
    return this._playlists().filter(p => p.userId === userId && p.isSystem !== true);
  }

  getLikedSongsPlaylist(userId: string): PlaylistResponse | undefined {
    return this._playlists().find(p => p.userId === userId && p.isSystem === true);
  }

  getPlaylistById(playlistId: string): PlaylistResponse | undefined {
    return this._playlists().find(p => p.id === playlistId);
  }

  getSongIdsForCurrentPlaylist(): string[] {
    return this._currentPlaylistSongs()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map(s => s.songId ?? '')
      .filter(id => id.length > 0);
  }

  /* ===================== */
  /* CREATE */
  /* ===================== */

  createPlaylist(
    payload: {
      name: string;
      description?: string | null;
      isPublic?: boolean;
    },
    onSuccess?: (playlist: PlaylistResponse) => void
  ): void {
    const body: CreatePlaylistRequest = {
      name: payload.name.trim(),
      description: payload.description ?? undefined,
      isPublic: payload.isPublic ?? true,
    };
    this._loading.set(true);
    this._error.set(null);
    this.playlistsApi.createPlaylist(body).subscribe({
      next: (playlist) => {
        this._playlists.update(list => [...list, playlist]);
        this._loading.set(false);
        onSuccess?.(playlist);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error creating playlist');
        this._loading.set(false);
      },
    });
  }

  /* ===================== */
  /* UPDATE */
  /* ===================== */

  updatePlaylist(
    playlistId: string,
    patch: {
      name?: string;
      description?: string | null;
      coverUrl?: string | null;
      isPublic?: boolean;
    },
    onSuccess?: (playlist: PlaylistResponse) => void
  ): void {
    const body: UpdatePlaylistRequest = {
      name: patch.name,
      description: patch.description ?? undefined,
      coverUrl: patch.coverUrl ?? undefined,
      isPublic: patch.isPublic,
    };
    this._loading.set(true);
    this._error.set(null);
    this.playlistsApi.updatePlaylist(playlistId, body).subscribe({
      next: (updated) => {
        this._playlists.update(list =>
          list.map(p => (p.id === playlistId ? updated : p))
        );
        this._loading.set(false);
        onSuccess?.(updated);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error updating playlist');
        this._loading.set(false);
      },
    });
  }

  /* ===================== */
  /* DELETE */
  /* ===================== */

  deletePlaylist(playlistId: string, onSuccess?: () => void): void {
    this._loading.set(true);
    this._error.set(null);
    this.playlistsApi.deletePlaylist(playlistId).subscribe({
      next: () => {
        this._playlists.update(list => list.filter(p => p.id !== playlistId));
        this._loading.set(false);
        onSuccess?.();
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error deleting playlist');
        this._loading.set(false);
      },
    });
  }

  /* ===================== */
  /* SONGS IN PLAYLIST */
  /* ===================== */

  addSongToPlaylist(playlistId: string, songId: string, onSuccess?: () => void): void {
    this.playlistSongsApi.addSongToPlaylist(playlistId, { songId }).subscribe({
      next: () => {
        this._playlists.update(list =>
          list.map(p =>
            p.id === playlistId
              ? { ...p, songCount: (p.songCount ?? 0) + 1 }
              : p
          )
        );
        this.loadPlaylistSongs(playlistId);
        onSuccess?.();
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error adding song to playlist');
      },
    });
  }

  removeSongFromPlaylist(playlistId: string, songId: string, onSuccess?: () => void): void {
    this.playlistSongsApi.removeSongFromPlaylist(playlistId, songId).subscribe({
      next: () => {
        this._currentPlaylistSongs.update(songs =>
          songs.filter(s => s.songId !== songId)
        );
        this._playlists.update(list =>
          list.map(p =>
            p.id === playlistId
              ? { ...p, songCount: Math.max(0, (p.songCount ?? 1) - 1) }
              : p
          )
        );
        onSuccess?.();
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error removing song from playlist');
      },
    });
  }

  /* ===================== */
  /* UTILS */
  /* ===================== */

  clearError(): void {
    this._error.set(null);
  }

  clearCurrentPlaylistSongs(): void {
    this._currentPlaylistSongs.set([]);
  }
}
