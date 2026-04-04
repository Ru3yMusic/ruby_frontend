import { Injectable, signal } from '@angular/core';

export interface PlaylistTrack {
  id: string;
  title: string;
  artist: string;
  cover: string;
}

export interface Playlist {
  id: string;
  name: string;
  owner: string;
  tracks: PlaylistTrack[];
  coverUrl?: string;
  description?: string;
  isPrivate?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PlaylistState {
  readonly playlist = signal<Playlist | null>(null);
  readonly recommendations = signal<PlaylistTrack[]>([
    { id: 'ode', title: 'Ode to Vivian', artist: 'Patrick Watson', cover: '#121826' },
    { id: 'missed', title: 'Missed You (Bonus Track)', artist: 'The Weeknd', cover: '#6f1718' },
    { id: 'suei', title: '07hoenn', artist: 'Suei', cover: '#4b2f74' },
    { id: 'cig', title: 'Cigarettes out the window', artist: 'TV Girl', cover: '#12345e' },
    { id: 'shorty', title: 'Shorty Q te vaya Bnn', artist: 'Resl B', cover: '#2a2f3c' },
  ]);
  readonly liked = signal<PlaylistTrack[]>([
    { id: 'borderline', title: 'Borderline', artist: 'Tame Impala', cover: '#7f2418' },
  ]);

  createPlaylist(name: string): Playlist {
    const created: Playlist = { id: 'para-dormir', name, owner: 'Yoel Quiroga', tracks: [] };
    this.playlist.set(created);
    return created;
  }

  addTracks(trackIds: string[]): void {
    const current = this.playlist();
    if (!current) return;

    const pool = [...this.recommendations(), ...this.liked()];
    const byId = new Map(current.tracks.map(t => [t.id, t]));
    trackIds.forEach(id => {
      const found = pool.find(t => t.id === id);
      if (found) byId.set(id, found);
    });

    this.playlist.set({ ...current, tracks: Array.from(byId.values()) });
  }

  removeTrack(trackId: string): PlaylistTrack | null {
    const current = this.playlist();
    if (!current) return null;
    const target = current.tracks.find(t => t.id === trackId) ?? null;
    this.playlist.set({ ...current, tracks: current.tracks.filter(t => t.id !== trackId) });
    return target;
  }

  restoreTrack(track: PlaylistTrack): void {
    const current = this.playlist();
    if (!current) return;
    if (current.tracks.some(t => t.id === track.id)) return;
    this.playlist.set({ ...current, tracks: [...current.tracks, track] });
  }

  togglePrivacy(): void {
    const current = this.playlist();
    if (!current) return;
    this.playlist.set({ ...current, isPrivate: !current.isPrivate });
  }

  updateMeta(updates: { name?: string; description?: string; coverUrl?: string }): void {
    const current = this.playlist();
    if (!current) return;
    this.playlist.set({ ...current, ...updates });
  }

  reorderTracks(trackIds: string[]): void {
    const current = this.playlist();
    if (!current) return;

    const byId = new Map(current.tracks.map(t => [t.id, t]));
    const reordered = trackIds.map(id => byId.get(id)).filter((t): t is PlaylistTrack => !!t);

    if (reordered.length !== current.tracks.length) return;
    this.playlist.set({ ...current, tracks: reordered });
  }
}
