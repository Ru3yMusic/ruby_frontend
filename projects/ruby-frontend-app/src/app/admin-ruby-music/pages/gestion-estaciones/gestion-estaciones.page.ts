import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AlertTriangle,
  Eye,
  Menu,
  Pencil,
  Plus,
  Radio,
  Search,
  Trash2,
} from 'lucide-angular';
import { forkJoin } from 'rxjs';

import { LucideAngularModule } from 'lucide-angular';
import { AdminSidebarComponent } from '../../components/admin-sidebar/admin-sidebar.component';
import {
  AlbumResponse,
  AlbumsApi,
  ArtistResponse,
  ArtistsApi,
  GenreResponse,
  GenresApi,
  SongResponse,
  SongsApi,
  StationResponse,
  StationsApi,
} from 'lib-ruby-sdks/catalog-service';

/* =========================
   MODELOS BASE
========================= */
interface Artist {
  id: string;
  name: string;
  photoUrl: string;
  bio: string;
  isTop: boolean;
  followersCount: string;
  monthlyListeners: string;
  createdAt: string;
}

interface Album {
  id: string;
  title: string;
  artistId: string;
  coverUrl: string;
  releaseDate: string;
  songsCount: number;
  totalStreams: string;
  createdAt: string;
}

interface Genre {
  id: string;
  name: string;
  count: number;
  createdAt: string;
  gradientStart: string;
  gradientEnd: string;
}

interface Song {
  id: string;
  title: string;
  artistId: string;
  albumId: string | null;
  genreId: string;
  coverUrl: string;
  audioUrl: string;
  durationSeconds: number;
  lyrics: string | null;
  playCount: number;
  likesCount: number;
  createdAt: string;
}

interface Station {
  id: string;
  name: string;
  genreId: string;
  songIds: string[];
  gradientStart: string;
  gradientEnd: string;
  liveListeners: number;
  createdAt: string;
}

/* =========================
   MODELOS UI
========================= */
interface SongFilterView extends Song {
  artistName: string;
  albumTitle: string;
}

interface StationView extends Station {
  genreName: string;
  songCount: number;
  liveListenersLabel: string;
}

/* =========================
   COMPONENTE
========================= */
@Component({
  selector: 'app-gestion-estaciones-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, AdminSidebarComponent],
  templateUrl: './gestion-estaciones.page.html',
  styleUrl: './gestion-estaciones.page.scss',
})
export class GestionEstacionesPage implements OnInit {
  /* =========================
     SERVICIOS
  ========================== */
  private readonly stationsApi = inject(StationsApi);
  private readonly genresApi = inject(GenresApi);
  private readonly songsApi = inject(SongsApi);
  private readonly artistsApi = inject(ArtistsApi);
  private readonly albumsApi = inject(AlbumsApi);

  /* =========================
     ICONOS
  ========================== */
  readonly Menu = Menu;
  readonly Search = Search;
  readonly Plus = Plus;
  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;
  readonly Eye = Eye;
  readonly Radio = Radio;
  readonly AlertTriangle = AlertTriangle;

  /* =========================
     UI STATE
  ========================== */
  readonly sidebarOpen = signal(false);
  readonly searchQuery = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /* =========================
     MODALES
  ========================== */
  readonly isCreateModalOpen = signal(false);
  readonly isEditModalOpen = signal(false);
  readonly isDetailModalOpen = signal(false);
  readonly isDeleteModalOpen = signal(false);

  /* =========================
     SELECCION
  ========================== */
  readonly selectedStation = signal<StationView | null>(null);

  /* =========================
     FORM CREATE
  ========================== */
  readonly createStationName = signal('');
  readonly createStationGenreId = signal('');
  readonly createGradientStart = signal('#FF8A00');
  readonly createGradientEnd = signal('#111111');
  readonly createArtistFilterId = signal('');
  readonly createArtistFilterQuery = signal('');
  readonly createAlbumFilterId = signal('');
  readonly createAlbumFilterQuery = signal('');
  readonly createSelectedSongIds = signal<string[]>([]);

  /* =========================
     FORM EDIT
  ========================== */
  readonly editStationName = signal('');
  readonly editGradientStart = signal('#FF8A00');
  readonly editGradientEnd = signal('#111111');
  readonly editArtistFilterId = signal('');
  readonly editArtistFilterQuery = signal('');
  readonly editAlbumFilterId = signal('');
  readonly editAlbumFilterQuery = signal('');
  readonly editSelectedSongIds = signal<string[]>([]);

  /* =========================
     DATA BASE
  ========================== */
  readonly genres = signal<Genre[]>([]);
  readonly songs = signal<Song[]>([]);
  readonly artists = signal<Artist[]>([]);
  readonly albums = signal<Album[]>([]);
  readonly stations = signal<Station[]>([]);

  /* =========================
     LIFECYCLE
  ========================== */
  ngOnInit(): void {
    this.reloadData();
  }

  /* =========================
     COMPUTED BASE
  ========================== */
  readonly availableGenres = computed(() => {
    return [...this.genres()].sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly stationViews = computed<StationView[]>(() => {
    const genres = this.genres();

    return this.stations()
      .map((station) => {
        const genre = genres.find((item) => item.id === station.genreId);

        return {
          ...station,
          genreName: genre?.name ?? 'Género no disponible',
          songCount: station.songIds.length,
          liveListenersLabel: this.formatCompactCount(station.liveListeners),
        };
      })
      .sort(
        (a, b) =>
          this.parseDateToTime(b.createdAt) - this.parseDateToTime(a.createdAt)
      );
  });

  readonly filteredStations = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();

    if (!query) {
      return this.stationViews();
    }

    return this.stationViews().filter((station) =>
      station.name.toLowerCase().includes(query)
    );
  });

  readonly songFilterViews = computed<SongFilterView[]>(() => {
    const artists = this.artists();
    const albums = this.albums();

    return this.songs().map((song) => {
      const artist = artists.find((item) => item.id === song.artistId);
      const album = song.albumId
        ? albums.find((item) => item.id === song.albumId)
        : null;

      return {
        ...song,
        artistName: artist?.name ?? 'Artista no disponible',
        albumTitle: album?.title ?? 'Single',
      };
    });
  });

  readonly filteredArtistsForCreate = computed(() => {
    const query = this.normalize(this.createArtistFilterQuery());

    return this.artists()
      .filter((artist) => {
        if (!query) return true;
        return this.normalize(artist.name).includes(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly filteredArtistsForEdit = computed(() => {
    const query = this.normalize(this.editArtistFilterQuery());

    return this.artists()
      .filter((artist) => {
        if (!query) return true;
        return this.normalize(artist.name).includes(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly filteredAlbumsForCreateStation = computed(() => {
    const artistId = this.createArtistFilterId().trim();
    const albumQuery = this.normalize(this.createAlbumFilterQuery());

    return this.albums()
      .filter((album) => {
        if (artistId && album.artistId !== artistId) return false;
        if (albumQuery && !this.normalize(album.title).includes(albumQuery)) return false;
        return true;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  });

  readonly filteredAlbumsForEditStation = computed(() => {
    const artistId = this.editArtistFilterId().trim();
    const albumQuery = this.normalize(this.editAlbumFilterQuery());

    return this.albums()
      .filter((album) => {
        if (artistId && album.artistId !== artistId) return false;
        if (albumQuery && !this.normalize(album.title).includes(albumQuery)) return false;
        return true;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  });

  readonly filteredSongsForCreateStation = computed(() => {
    const genreId = this.createStationGenreId().trim();
    const artistId = this.createArtistFilterId().trim();
    const albumId = this.createAlbumFilterId().trim();

    if (!genreId) return [];

    return this.songFilterViews()
      .filter((song) => {
        if (song.genreId !== genreId) return false;
        if (artistId && song.artistId !== artistId) return false;
        if (albumId) {
          if (!song.albumId) return false;
          if (song.albumId !== albumId) return false;
        }
        return true;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  });

  readonly filteredSongsForEditStation = computed(() => {
    const current = this.selectedStation();
    const artistId = this.editArtistFilterId().trim();
    const albumId = this.editAlbumFilterId().trim();

    if (!current) return [];

    return this.songFilterViews()
      .filter((song) => {
        if (song.genreId !== current.genreId) return false;
        if (artistId && song.artistId !== artistId) return false;
        if (albumId) {
          if (!song.albumId) return false;
          if (song.albumId !== albumId) return false;
        }
        return true;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  });

  readonly anyModalOpen = computed(() => {
    return (
      this.isCreateModalOpen() ||
      this.isEditModalOpen() ||
      this.isDetailModalOpen() ||
      this.isDeleteModalOpen()
    );
  });

  /* =========================
     MAPPERS SDK → LOCAL
  ========================== */
  private mapGenres(sdkGenres: GenreResponse[]): Genre[] {
    return sdkGenres.map((g) => ({
      id: g.id ?? '',
      name: g.name ?? '',
      count: g.songCount ?? 0,
      createdAt: g.createdAt ?? '',
      gradientStart: g.gradientStart ?? '#FF8A00',
      gradientEnd: g.gradientEnd ?? '#111111',
    }));
  }

  private mapSongs(sdkSongs: SongResponse[]): Song[] {
    return sdkSongs.map((s) => ({
      id: s.id ?? '',
      title: s.title ?? '',
      artistId: s.artist?.id ?? '',
      albumId: s.album?.id ?? null,
      genreId: s.genres?.[0]?.id ?? '',
      coverUrl: s.coverUrl ?? '',
      audioUrl: s.audioUrl ?? '',
      durationSeconds: s.duration ?? 0,
      lyrics: s.lyrics ?? null,
      playCount: s.playCount ?? 0,
      likesCount: s.likesCount ?? 0,
      createdAt: '',
    }));
  }

  private mapArtists(sdkArtists: ArtistResponse[]): Artist[] {
    return sdkArtists.map((a) => ({
      id: a.id ?? '',
      name: a.name ?? '',
      photoUrl: a.photoUrl ?? '',
      bio: a.bio ?? '',
      isTop: a.isTop ?? false,
      followersCount: `${a.followersCount ?? 0} seguidores`,
      monthlyListeners: `${a.monthlyListeners ?? 0} oyentes`,
      createdAt: a.createdAt ?? '',
    }));
  }

  private mapAlbums(sdkAlbums: AlbumResponse[]): Album[] {
    return sdkAlbums.map((a) => ({
      id: a.id ?? '',
      title: a.title ?? '',
      artistId: a.artist?.id ?? '',
      coverUrl: a.coverUrl ?? '',
      releaseDate: a.releaseDate ?? '',
      songsCount: a.songCount ?? 0,
      totalStreams: `${a.totalStreams ?? 0} streams`,
      createdAt: a.releaseDate ?? '',
    }));
  }

  private mapStations(sdkStations: StationResponse[]): Station[] {
    return sdkStations.map((s) => ({
      id: s.id ?? '',
      name: s.name ?? '',
      genreId: s.genreId ?? '',
      songIds: new Array(s.songCount ?? 0).fill('') as string[],
      gradientStart: s.gradientStart ?? '#FF8A00',
      gradientEnd: s.gradientEnd ?? '#111111',
      liveListeners: 0,
      createdAt: s.createdAt ?? '',
    }));
  }

  /* =========================
     CARGA / RECARGA
  ========================== */
  private reloadData(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      stations: this.stationsApi.listStations(),
      genres: this.genresApi.listGenres(),
      songs: this.songsApi.listSongs(),
      artists: this.artistsApi.listArtists(),
      albums: this.albumsApi.listAlbums(),
    }).subscribe({
      next: ({ stations, genres, songs, artists, albums }) => {
        this.genres.set(this.mapGenres(genres));
        this.songs.set(this.mapSongs(songs.content ?? []));
        this.artists.set(this.mapArtists(artists.content ?? []));
        this.albums.set(this.mapAlbums(albums.content ?? []));
        this.stations.set(this.mapStations(stations.content ?? []));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al cargar las estaciones');
        this.loading.set(false);
      },
    });
  }

  private reloadStations(): void {
    this.loading.set(true);
    this.error.set(null);

    this.stationsApi.listStations().subscribe({
      next: (page) => {
        this.stations.set(this.mapStations(page.content ?? []));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al recargar las estaciones');
        this.loading.set(false);
      },
    });
  }

  /* =========================
     HELPERS
  ========================== */
  private normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private parseDateToTime(value: string): number {
    if (!value) return 0;

    const isoDate = new Date(value);
    if (!Number.isNaN(isoDate.getTime())) {
      return isoDate.getTime();
    }

    const parts = value.split('/').map(Number);
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return new Date(year, month - 1, day).getTime();
    }

    return 0;
  }

  private formatCompactCount(value: number): string {
    if (value >= 1_000_000) {
      const formatted = value / 1_000_000;
      return `${formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1)} M`;
    }

    if (value >= 1_000) {
      const formatted = value / 1_000;
      return `${formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1)}k`;
    }

    return `${value}`;
  }

  private existsStationName(name: string, excludeId?: string): boolean {
    const normalizedName = this.normalize(name);

    return this.stations().some(
      (station) =>
        this.normalize(station.name) === normalizedName &&
        station.id !== excludeId
    );
  }

  private resetCreateForm(): void {
    this.createStationName.set('');
    this.createStationGenreId.set('');
    this.createGradientStart.set('#FF8A00');
    this.createGradientEnd.set('#111111');
    this.createArtistFilterId.set('');
    this.createArtistFilterQuery.set('');
    this.createAlbumFilterId.set('');
    this.createAlbumFilterQuery.set('');
    this.createSelectedSongIds.set([]);
  }

  private resetEditForm(): void {
    this.editStationName.set('');
    this.editGradientStart.set('#FF8A00');
    this.editGradientEnd.set('#111111');
    this.editArtistFilterId.set('');
    this.editArtistFilterQuery.set('');
    this.editAlbumFilterId.set('');
    this.editAlbumFilterQuery.set('');
    this.editSelectedSongIds.set([]);
  }

  /* =========================
     UI HELPERS
  ========================== */
  onCreateGenreChange(genreId: string): void {
    this.createStationGenreId.set(genreId);
    this.createArtistFilterId.set('');
    this.createArtistFilterQuery.set('');
    this.createAlbumFilterId.set('');
    this.createAlbumFilterQuery.set('');
    this.createSelectedSongIds.set([]);

    const genre = this.genres().find((item) => item.id === genreId);

    if (!genre) {
      this.createGradientStart.set('#FF8A00');
      this.createGradientEnd.set('#111111');
      return;
    }

    this.createGradientStart.set(genre.gradientStart);
    this.createGradientEnd.set(genre.gradientEnd);
  }

  onCreateArtistFilterChange(artistId: string): void {
    this.createArtistFilterId.set(artistId);
    this.createAlbumFilterId.set('');
    this.createAlbumFilterQuery.set('');
  }

  onEditArtistFilterChange(artistId: string): void {
    this.editArtistFilterId.set(artistId);
    this.editAlbumFilterId.set('');
    this.editAlbumFilterQuery.set('');
  }

  isCreateSongSelected(songId: string): boolean {
    return this.createSelectedSongIds().includes(songId);
  }

  toggleCreateSongSelection(songId: string): void {
    const current = this.createSelectedSongIds();

    if (current.includes(songId)) {
      this.createSelectedSongIds.set(current.filter((id) => id !== songId));
      return;
    }

    this.createSelectedSongIds.set([...current, songId]);
  }

  isEditSongSelected(songId: string): boolean {
    return this.editSelectedSongIds().includes(songId);
  }

  toggleEditSongSelection(songId: string): void {
    const current = this.editSelectedSongIds();

    if (current.includes(songId)) {
      this.editSelectedSongIds.set(current.filter((id) => id !== songId));
      return;
    }

    this.editSelectedSongIds.set([...current, songId]);
  }

  /* =========================
     MODALES
  ========================== */
  openCreateModal(): void {
    this.resetCreateForm();
    this.isCreateModalOpen.set(true);
  }

  openEditModal(station: StationView): void {
    this.selectedStation.set(station);

    this.editStationName.set(station.name);
    this.editGradientStart.set(station.gradientStart);
    this.editGradientEnd.set(station.gradientEnd);
    this.editArtistFilterId.set('');
    this.editArtistFilterQuery.set('');
    this.editAlbumFilterId.set('');
    this.editAlbumFilterQuery.set('');
    this.editSelectedSongIds.set([...station.songIds]);

    this.isEditModalOpen.set(true);
  }

  openDetailModal(station: StationView): void {
    this.selectedStation.set(station);
    this.isDetailModalOpen.set(true);
  }

  openDeleteModal(station: StationView): void {
    this.selectedStation.set(station);
    this.isDeleteModalOpen.set(true);
  }

  /* =========================
     CREATE
  ========================== */
  createStation(): void {
    const name = this.createStationName().trim();
    const genreId = this.createStationGenreId().trim();
    const gradientStart = this.createGradientStart();
    const gradientEnd = this.createGradientEnd();
    const selectedSongIds = this.createSelectedSongIds();

    if (!name || !genreId || !gradientStart || !gradientEnd) return;
    if (this.existsStationName(name)) return;
    if (selectedSongIds.length < 2) return;

    const genre = this.genres().find((item) => item.id === genreId);
    if (!genre) return;

    const validSongs = this.songs().filter((song) => selectedSongIds.includes(song.id));
    if (
      validSongs.length !== selectedSongIds.length ||
      validSongs.some((song) => song.genreId !== genreId)
    ) return;

    this.loading.set(true);
    this.error.set(null);

    this.stationsApi.createStation({
      name,
      genreId,
      gradientStart,
      gradientEnd,
      songIds: [...selectedSongIds],
    }).subscribe({
      next: () => {
        this.closeAllModals();
        this.reloadStations();
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al crear la estación');
        this.loading.set(false);
      },
    });
  }

  /* =========================
     EDIT
  ========================== */
  saveStationEdit(): void {
    const current = this.selectedStation();
    if (!current) return;

    const name = this.editStationName().trim();
    const gradientStart = this.editGradientStart();
    const gradientEnd = this.editGradientEnd();
    const selectedSongIds = this.editSelectedSongIds();

    if (!name || !gradientStart || !gradientEnd) return;
    if (this.existsStationName(name, current.id)) return;
    if (selectedSongIds.length < 2) return;

    const validSongs = this.songs().filter((song) => selectedSongIds.includes(song.id));
    if (
      validSongs.length !== selectedSongIds.length ||
      validSongs.some((song) => song.genreId !== current.genreId)
    ) return;

    this.loading.set(true);
    this.error.set(null);

    this.stationsApi.updateStation(current.id, {
      name,
      genreId: current.genreId,
      gradientStart,
      gradientEnd,
      songIds: [...selectedSongIds],
    }).subscribe({
      next: () => {
        this.closeAllModals();
        this.reloadStations();
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al actualizar la estación');
        this.loading.set(false);
      },
    });
  }

  /* =========================
     DELETE
  ========================== */
  confirmDeleteStation(): void {
    const current = this.selectedStation();
    if (!current) return;

    this.loading.set(true);
    this.error.set(null);

    this.stationsApi.deleteStation(current.id).subscribe({
      next: () => {
        this.closeAllModals();
        this.reloadStations();
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al eliminar la estación');
        this.loading.set(false);
      },
    });
  }

  /* =========================
     CIERRE GENERAL
  ========================== */
  closeAllModals(): void {
    this.isCreateModalOpen.set(false);
    this.isEditModalOpen.set(false);
    this.isDetailModalOpen.set(false);
    this.isDeleteModalOpen.set(false);

    this.selectedStation.set(null);

    this.resetCreateForm();
    this.resetEditForm();
  }
}
