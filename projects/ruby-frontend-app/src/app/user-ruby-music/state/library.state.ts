import { Injectable, signal } from '@angular/core';

export interface LibraryArtist {
  id: string;
  name: string;
  image: string;
}

export interface AlbumTrack {
  id: string;
  title: string;
  duration: string;
}

export interface LibraryAlbum {
  id: string;
  title: string;
  artist: string;
  cover: string;
  year: number;
  description: string;
  tracks: AlbumTrack[];
}

@Injectable({ providedIn: 'root' })
export class LibraryState {
  readonly artists = signal<LibraryArtist[]>([]);
  readonly albums = signal<LibraryAlbum[]>([]);

  setArtists(artists: LibraryArtist[]): void {
    this.artists.set(artists);
  }

  addArtists(artists: LibraryArtist[]): void {
    const current = this.artists();
    const byId = new Map(current.map(a => [a.id, a]));
    artists.forEach(a => byId.set(a.id, a));
    this.artists.set(Array.from(byId.values()));
  }

  addAlbums(albums: LibraryAlbum[]): void {
    const current = this.albums();
    const byId = new Map(current.map(a => [a.id, a]));
    albums.forEach(a => byId.set(a.id, a));
    this.albums.set(Array.from(byId.values()));
  }
}
