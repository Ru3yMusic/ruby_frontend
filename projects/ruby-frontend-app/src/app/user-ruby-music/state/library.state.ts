import { Injectable, computed, inject, signal } from '@angular/core';
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

  loadTopArtists(): void {
    this._loading.set(true);
    this._error.set(null);
    this.artistsApi.getTopArtists().subscribe({
      next: (artists) => {
        this._artists.set(artists);
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
  /* UTILS */
  /* ===================== */

  clearError(): void {
    this._error.set(null);
  }

  clearSongs(): void {
    this._songs.set([]);
  }
}
