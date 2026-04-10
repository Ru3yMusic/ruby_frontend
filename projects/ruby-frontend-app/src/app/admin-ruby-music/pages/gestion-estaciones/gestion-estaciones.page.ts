import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
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

import { LucideAngularModule } from 'lucide-angular';
import { AdminSidebarComponent } from '../../components/admin-sidebar/admin-sidebar.component';

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
export class GestionEstacionesPage {
  /* =========================
     STORAGE KEYS
  ========================== */
  private readonly STATIONS_KEY = 'ruby_stations';
  private readonly GENRES_KEY = 'ruby_genres';
  private readonly SONGS_KEY = 'ruby_songs';
  private readonly ARTISTS_KEY = 'ruby_artists';
  private readonly ALBUMS_KEY = 'ruby_albums';

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
  readonly genres = signal<Genre[]>(this.loadGenres());
  readonly songs = signal<Song[]>(this.loadSongs());
  readonly artists = signal<Artist[]>(this.loadArtists());
  readonly albums = signal<Album[]>(this.loadAlbums());
  readonly stations = signal<Station[]>(this.loadStations());

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
     STORAGE
  ========================== */
  private loadGenres(): Genre[] {
    const stored = localStorage.getItem(this.GENRES_KEY);

    if (!stored) return [];

    try {
      return JSON.parse(stored) as Genre[];
    } catch {
      localStorage.removeItem(this.GENRES_KEY);
      return [];
    }
  }

  private loadSongs(): Song[] {
    const stored = localStorage.getItem(this.SONGS_KEY);

    if (!stored) return [];

    try {
      return JSON.parse(stored) as Song[];
    } catch {
      localStorage.removeItem(this.SONGS_KEY);
      return [];
    }
  }

  private loadArtists(): Artist[] {
    const stored = localStorage.getItem(this.ARTISTS_KEY);

    if (!stored) return [];

    try {
      return JSON.parse(stored) as Artist[];
    } catch {
      localStorage.removeItem(this.ARTISTS_KEY);
      return [];
    }
  }

  private loadAlbums(): Album[] {
    const stored = localStorage.getItem(this.ALBUMS_KEY);

    if (!stored) return [];

    try {
      return JSON.parse(stored) as Album[];
    } catch {
      localStorage.removeItem(this.ALBUMS_KEY);
      return [];
    }
  }

  private loadStations(): Station[] {
    const stored = localStorage.getItem(this.STATIONS_KEY);

    if (stored) {
      try {
        return JSON.parse(stored) as Station[];
      } catch {
        localStorage.removeItem(this.STATIONS_KEY);
      }
    }

    const genres = this.loadGenres();
    const songs = this.loadSongs();

    if (genres.length === 0) {
      return [];
    }

    const indieGenre = genres.find(
      (genre) => this.normalize(genre.name) === 'indie'
    ) ?? genres[0];

    const jazzGenre = genres.find(
      (genre) => this.normalize(genre.name) === 'jazz'
    ) ?? genres[0];

    const indieSongs = songs
      .filter((song) => song.genreId === indieGenre.id)
      .slice(0, Math.max(2, Math.min(25, songs.length)))
      .map((song) => song.id);

    const jazzSongs = songs
      .filter((song) => song.genreId === jazzGenre.id)
      .slice(0, Math.max(2, Math.min(10, songs.length)))
      .map((song) => song.id);

    const baseStations: Station[] = [

    ];

    localStorage.setItem(this.STATIONS_KEY, JSON.stringify(baseStations));
    return baseStations;
  }

  private persistStations(stations: Station[]): void {
    localStorage.setItem(this.STATIONS_KEY, JSON.stringify(stations));
    this.stations.set(stations);
  }

  /* =========================
     HELPERS
  ========================== */
  private normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private getTodayFormatted(): string {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  }

  private parseDateToTime(value: string): number {
    const parts = value.split('/').map(Number);

    if (parts.length !== 3) return 0;

    const [day, month, year] = parts;
    return new Date(year, month - 1, day).getTime();
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

    if (!name || !genreId || !gradientStart || !gradientEnd) {
      return;
    }

    if (this.existsStationName(name)) {
      return;
    }

    if (selectedSongIds.length < 2) {
      return;
    }

    const genre = this.genres().find((item) => item.id === genreId);
    if (!genre) {
      return;
    }

    const validSongs = this.songs().filter((song) => selectedSongIds.includes(song.id));

    if (
      validSongs.length !== selectedSongIds.length ||
      validSongs.some((song) => song.genreId !== genreId)
    ) {
      return;
    }

    const newStation: Station = {
      id: crypto.randomUUID(),
      name,
      genreId,
      songIds: [...selectedSongIds],
      gradientStart,
      gradientEnd,
      liveListeners: 0,
      createdAt: this.getTodayFormatted(),
    };

    this.persistStations([newStation, ...this.stations()]);
    this.closeAllModals();
  }

  /* =========================
     EDIT
  ========================== */
  saveStationEdit(): void {
    const current = this.selectedStation();

    if (!current) {
      return;
    }

    const name = this.editStationName().trim();
    const gradientStart = this.editGradientStart();
    const gradientEnd = this.editGradientEnd();
    const selectedSongIds = this.editSelectedSongIds();

    if (!name || !gradientStart || !gradientEnd) {
      return;
    }

    if (this.existsStationName(name, current.id)) {
      return;
    }

    if (selectedSongIds.length < 2) {
      return;
    }

    const validSongs = this.songs().filter((song) => selectedSongIds.includes(song.id));

    if (
      validSongs.length !== selectedSongIds.length ||
      validSongs.some((song) => song.genreId !== current.genreId)
    ) {
      return;
    }

    const updatedStations = this.stations().map((station) =>
      station.id === current.id
        ? {
            ...station,
            name,
            gradientStart,
            gradientEnd,
            songIds: [...selectedSongIds],
          }
        : station
    );

    this.persistStations(updatedStations);
    this.closeAllModals();
  }

  /* =========================
     DELETE
  ========================== */
  confirmDeleteStation(): void {
    const current = this.selectedStation();

    if (!current) {
      return;
    }

    const updatedStations = this.stations().filter(
      (station) => station.id !== current.id
    );

    this.persistStations(updatedStations);
    this.closeAllModals();
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