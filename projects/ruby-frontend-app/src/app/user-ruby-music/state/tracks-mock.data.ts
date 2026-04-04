export interface TrackItem {
  id: number;
  title: string;
  artist: string;
  color: string;
}

/** Tracks shown in "Escuchar ahora" (Home + Music Search) */
export const HOME_TRACKS: TrackItem[] = [
  { id: 1, title: 'One more night',       artist: 'Maroon 5',       color: '#1a7b61' },
  { id: 2, title: 'Today was a good day', artist: 'Ice Cube',        color: '#153f6e' },
  { id: 3, title: 'Muralla verde',        artist: 'Enanitos Verdes', color: '#977523' },
];

/** Tracks for the Rebel Yell album (Billy Idol) */
export const ALBUM_REBEL_YELL_TRACKS: TrackItem[] = [
  { id: 4, title: 'Eyes without a face', artist: 'Billy Idol', color: '#153f6e' },
  { id: 5, title: 'Rebel Yell',          artist: 'Billy Idol', color: '#977523' },
  { id: 6, title: 'Flesh for Fantasy',   artist: 'Billy Idol', color: '#5e3272' },
  { id: 7, title: 'White Wedding',       artist: 'Billy Idol', color: '#153f6e' },
];

/** Tracks for Heroes Del Silencio */
export const ARTIST_HEROES_TRACKS: TrackItem[] = [
  { id: 8,  title: 'Maldito duende',    artist: 'Heroes Del Silencio', color: '#153f6e' },
  { id: 9,  title: 'Entre dos tierras', artist: 'Heroes Del Silencio', color: '#977523' },
  { id: 10, title: 'Heroe de leyenda',  artist: 'Heroes Del Silencio', color: '#977523' },
  { id: 11, title: 'La carta',          artist: 'Heroes Del Silencio', color: '#6e2d2d' },
];

/** Unified registry – used by the music player to resolve any track by id */
export const ALL_TRACKS: TrackItem[] = [
  ...HOME_TRACKS,
  ...ALBUM_REBEL_YELL_TRACKS,
  ...ARTIST_HEROES_TRACKS,
];
