import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  AlbumsApi,
  AlbumResponse,
  ArtistsApi,
  ArtistResponse,
  GenresApi,
  GenreResponse,
  SongsApi,
  SongResponse,
  StationsApi,
  StationResponse,
} from 'lib-ruby-sdks/catalog-service';

@Injectable({
  providedIn: 'root',
})
export class LibraryState {
  private readonly songsApi = inject(SongsApi);
  private readonly artistsApi = inject(ArtistsApi);
  private readonly genresApi = inject(GenresApi);
  private readonly albumsApi = inject(AlbumsApi);
  private readonly stationsApi = inject(StationsApi);

  /* ===================== */
  /* SIGNALS */
  /* ===================== */

  private readonly _songs = signal<SongResponse[]>([]);
  readonly songs = this._songs.asReadonly();

  // Caché por id, hidratado on-demand desde catalog-service o por upsert de vistas
  // que ya tienen el SongResponse a mano (station-detail, etc.). NO reemplaza _songs;
  // es complementario para cubrir canciones fuera de "recent songs" / search.
  private readonly _songsById = signal<Record<string, SongResponse>>({});
  private readonly _inflightSongIds = new Set<string>();

  private readonly _artists = signal<ArtistResponse[]>([]);
  readonly artists = this._artists.asReadonly();

  private readonly _genres = signal<GenreResponse[]>([]);
  readonly genres = this._genres.asReadonly();

  private readonly _albums = signal<AlbumResponse[]>([]);
  readonly albums = this._albums.asReadonly();

  private readonly _stations = signal<StationResponse[]>([]);
  readonly stations = this._stations.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  /* ===================== */
  /* COMPUTED */
  /* ===================== */

  readonly hasSongs = computed(() => this._songs().length > 0);
  readonly hasArtists = computed(() => this._artists().length > 0);
  readonly hasGenres = computed(() => this._genres().length > 0);
  readonly hasAlbums = computed(() => this._albums().length > 0);
  readonly hasStations = computed(() => this._stations().length > 0);

  /* ===================== */
  /* LOADERS */
  /* ===================== */

  loadRecentSongs(): void {
    this._loading.set(true);
    this._error.set(null);
    this.songsApi.getRecentSongs().subscribe({
      next: (songs) => {
        this._songs.set(songs);
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading songs');
        this._loading.set(false);
      },
    });
  }

  loadArtists(): void {
    // Catálogo completo de artistas (usado para lookups por ID en todo user).
    // Componentes que necesiten solo destacados filtran por isTop inline.
    this._loading.set(true);
    this._error.set(null);
    this.artistsApi.listArtists(undefined, 0, 500).subscribe({
      next: (page) => {
        this._artists.set(page.content ?? []);
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading artists');
        this._loading.set(false);
      },
    });
  }

  loadGenres(): void {
    this._loading.set(true);
    this._error.set(null);
    this.genresApi.listGenres().subscribe({
      next: (genres) => {
        this._genres.set(genres);
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading genres');
        this._loading.set(false);
      },
    });
  }

  loadNewReleases(): void {
    this._loading.set(true);
    this._error.set(null);
    this.albumsApi.getNewReleases().subscribe({
      next: (page) => {
        this._albums.set(page.content ?? []);
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading albums');
        this._loading.set(false);
      },
    });
  }

  loadActiveStations(): void {
    this._loading.set(true);
    this._error.set(null);
    this.stationsApi.listActiveStations().subscribe({
      next: (stations) => {
        this._stations.set(stations);
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading stations');
        this._loading.set(false);
      },
    });
  }

  /* ===================== */
  /* SEARCH */
  /* ===================== */

  searchSongs(query: string): void {
    if (!query.trim()) {
      this._songs.set([]);
      return;
    }
    this._loading.set(true);
    this._error.set(null);
    this.songsApi.searchSongs(query).subscribe({
      next: (page) => {
        this._songs.set(page.content ?? []);
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error searching songs');
        this._loading.set(false);
      },
    });
  }

  searchArtists(query: string): void {
    if (!query.trim()) {
      this._artists.set([]);
      return;
    }
    this._loading.set(true);
    this._error.set(null);
    this.artistsApi.searchArtists(query).subscribe({
      next: (page) => {
        this._artists.set(page.content ?? []);
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error searching artists');
        this._loading.set(false);
      },
    });
  }

  /* ===================== */
  /* DETAIL FETCHERS */
  /* These return Observables directly and do NOT mutate shared signals. */
  /* Detail pages subscribe independently. */
  /* ===================== */

  getArtistSongs(artistId: string): Observable<SongResponse[]> {
    return this.artistsApi.getArtistSongs(artistId).pipe(
      map(page => page.content ?? [])
    );
  }

  getAlbumSongs(albumId: string): Observable<SongResponse[]> {
    return this.albumsApi.getAlbumSongs(albumId).pipe(
      map(page => page.content ?? [])
    );
  }

  getSongsByStation(stationId: string): Observable<SongResponse[]> {
    return this.stationsApi.getSongsByStation(stationId).pipe(
      map(page => page.content ?? [])
    );
  }

  /* ===================== */
  /* SONG-BY-ID CACHE */
  /* ===================== */

  getSongById(songId: string): SongResponse | undefined {
    if (!songId) return undefined;
    return this._songsById()[songId]
      ?? this._songs().find(s => (s as any).id === songId);
  }

  /**
   * Returns a SongResponse Observable, resolving from the in-memory cache when
   * available (synchronous of()) or hitting catalog-service otherwise. The
   * fetched song is written back into the cache so subsequent lookups are
   * instant. Used by library's playlist play button — we need the real song
   * payload to hand to PlayerState.playSong() and can't rely on fire-and-
   * forget hydration when the user is starting playback.
   */
  loadSongById(songId: string): Observable<SongResponse> {
    const cached = this.getSongById(songId);
    if (cached) return of(cached);
    return this.songsApi.getSongById(songId).pipe(
      tap(song => {
        const id = (song as any)?.id;
        if (id) this._songsById.update(cache => ({ ...cache, [id]: song }));
      }),
    );
  }

  upsertSongs(songs: SongResponse[]): void {
    if (!songs?.length) return;
    this._songsById.update(map => {
      const next = { ...map };
      for (const song of songs) {
        const id = (song as any)?.id as string | undefined;
        if (id) next[id] = song;
      }
      return next;
    });
  }

  /**
   * Merges one artist into the global artists signal. Used by artist-detail
   * on refresh: the route id may not be covered by the default catalog load
   * (paginated / filtered), so the page fetches it by id and upserts so
   * downstream `currentArtist` computed resolves instead of staying null.
   */
  upsertArtist(artist: ArtistResponse): void {
    const id = (artist as any)?.id as string | undefined;
    if (!id) return;
    this._artists.update(list => {
      const idx = list.findIndex(a => (a as any).id === id);
      if (idx < 0) return [...list, artist];
      const next = [...list];
      next[idx] = artist;
      return next;
    });
  }

  /** Same idea as upsertArtist, but for albums — used by album-detail and
   * by artist-detail when it pulls the artist's own albums on refresh. */
  upsertAlbums(albums: AlbumResponse[]): void {
    if (!albums?.length) return;
    this._albums.update(list => {
      const byId = new Map<string, AlbumResponse>();
      for (const existing of list) {
        const id = (existing as any)?.id as string | undefined;
        if (id) byId.set(id, existing);
      }
      for (const album of albums) {
        const id = (album as any)?.id as string | undefined;
        if (id) byId.set(id, album);
      }
      return Array.from(byId.values());
    });
  }

  upsertAlbum(album: AlbumResponse): void {
    if (!album) return;
    this.upsertAlbums([album]);
  }

  ensureSongsLoaded(songIds: string[]): void {
    if (!songIds?.length) return;
    const cache = this._songsById();
    const list = this._songs();
    const missing = songIds.filter(id => {
      if (!id) return false;
      if (cache[id]) return false;
      if (list.some(s => (s as any).id === id)) return false;
      if (this._inflightSongIds.has(id)) return false;
      return true;
    });
    if (missing.length === 0) return;

    for (const id of missing) {
      this._inflightSongIds.add(id);
      this.songsApi.getSongById(id).subscribe({
        next: (song) => {
          this._inflightSongIds.delete(id);
          this._songsById.update(map => ({ ...map, [id]: song }));
        },
        error: () => {
          this._inflightSongIds.delete(id);
        },
      });
    }
  }

  /* ===================== */
  /* UTILS */
  /* ===================== */

  clearError(): void {
    this._error.set(null);
  }

  clearSongs(): void {
    this._songs.set([]);
  }
}
