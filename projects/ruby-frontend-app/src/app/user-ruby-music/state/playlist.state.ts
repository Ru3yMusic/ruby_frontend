import { computed, Injectable, signal } from '@angular/core';
import { Playlist } from '../models/playlist.model';

@Injectable({
  providedIn: 'root',
})
export class PlaylistState {
  private readonly STORAGE_KEY = 'ruby_playlists';

  private readonly _playlists = signal<Playlist[]>(this.loadPlaylists());
  readonly playlists = this._playlists.asReadonly();

  readonly totalPlaylists = computed(() => this._playlists().length);

  /* ===================== */
  /* LOAD / PERSIST */
  /* ===================== */
  private loadPlaylists(): Playlist[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private persistPlaylists(playlists: Playlist[]): void {
    this._playlists.set(playlists);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(playlists));
  }

  /* ===================== */
  /* HELPERS */
  /* ===================== */
  private generateId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  /* ===================== */
  /* GETTERS */
  /* ===================== */
  getPlaylistsByUser(userId: string): Playlist[] {
    return this._playlists().filter(playlist => playlist.userId === userId);
  }

  getPublicPlaylistsByUser(userId: string): Playlist[] {
    return this._playlists().filter(
      playlist => playlist.userId === userId && playlist.visibility === 'PUBLIC'
    );
  }

  getCustomPlaylistsByUser(userId: string): Playlist[] {
    return this._playlists().filter(
      playlist => playlist.userId === userId && playlist.type === 'CUSTOM'
    );
  }

  getLikedSongsPlaylist(userId: string): Playlist | undefined {
    return this._playlists().find(
      playlist =>
        playlist.userId === userId &&
        playlist.type === 'SYSTEM' &&
        playlist.systemType === 'LIKED_SONGS'
    );
  }

  /* ===================== */
  /* ENSURE SYSTEM PLAYLIST */
  /* ===================== */
  ensureLikedSongsPlaylist(userId: string): Playlist {
    const existing = this.getLikedSongsPlaylist(userId);

    if (existing) {
      return existing;
    }

    const now = this.nowIso();

    const likedSongsPlaylist: Playlist = {
      id: this.generateId(),
      userId,
      name: 'Tus me gusta',
      description: 'Playlist automática con tus canciones favoritas',
      coverUrl: null,
      visibility: 'PUBLIC',
      type: 'SYSTEM',
      systemType: 'LIKED_SONGS',
      songIds: [],
      createdAt: now,
      updatedAt: now,
    };

    const updated = [...this._playlists(), likedSongsPlaylist];
    this.persistPlaylists(updated);

    return likedSongsPlaylist;
  }

  /* ===================== */
  /* CREATE PLAYLIST */
  /* ===================== */
  createPlaylist(payload: {
    userId: string;
    name: string;
    description?: string | null;
    coverUrl?: string | null;
    visibility?: 'PUBLIC' | 'PRIVATE';
  }): Playlist {
    const now = this.nowIso();

    const newPlaylist: Playlist = {
      id: this.generateId(),
      userId: payload.userId,
      name: payload.name.trim(),
      description: payload.description ?? null,
      coverUrl: payload.coverUrl ?? null,
      visibility: payload.visibility ?? 'PUBLIC',
      type: 'CUSTOM',
      systemType: null,
      songIds: [],
      createdAt: now,
      updatedAt: now,
    };

    const updated = [...this._playlists(), newPlaylist];
    this.persistPlaylists(updated);

    return newPlaylist;
  }

  /* ===================== */
  /* UPDATE PLAYLIST */
  /* ===================== */
  updatePlaylist(
    playlistId: string,
    patch: Partial<Omit<Playlist, 'id' | 'userId' | 'type' | 'systemType' | 'createdAt'>>
  ): void {
    const updated = this._playlists().map(playlist => {
      if (playlist.id !== playlistId) return playlist;

      return {
        ...playlist,
        ...patch,
        updatedAt: this.nowIso(),
      };
    });

    this.persistPlaylists(updated);
  }

  /* ===================== */
  /* SONGS IN PLAYLIST */
  /* ===================== */
  addSongToPlaylist(playlistId: string, songId: string): void {
    const updated = this._playlists().map(playlist => {
      if (playlist.id !== playlistId) return playlist;
      if (playlist.songIds.includes(songId)) return playlist;

      return {
        ...playlist,
        songIds: [...playlist.songIds, songId],
        updatedAt: this.nowIso(),
      };
    });

    this.persistPlaylists(updated);
  }

  removeSongFromPlaylist(playlistId: string, songId: string): void {
    const updated = this._playlists().map(playlist => {
      if (playlist.id !== playlistId) return playlist;

      return {
        ...playlist,
        songIds: playlist.songIds.filter(id => id !== songId),
        updatedAt: this.nowIso(),
      };
    });

    this.persistPlaylists(updated);
  }

  /* ===================== */
  /* LIKED SONGS HELPERS */
  /* ===================== */
  addSongToLikedSongs(userId: string, songId: string): void {
    const likedSongsPlaylist = this.ensureLikedSongsPlaylist(userId);
    this.addSongToPlaylist(likedSongsPlaylist.id, songId);
  }

  removeSongFromLikedSongs(userId: string, songId: string): void {
    const likedSongsPlaylist = this.getLikedSongsPlaylist(userId);
    if (!likedSongsPlaylist) return;

    this.removeSongFromPlaylist(likedSongsPlaylist.id, songId);
  }
}