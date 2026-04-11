import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import {
  AlertTriangle,
  Eye,
  Heart,
  Menu,
  Pencil,
  Play,
  Plus,
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

/* =========================
   MODELO UI
========================= */
interface SongView extends Song {
  artistName: string;
  artistPhotoUrl: string;
  albumTitle: string;
  genreName: string;
  genreGradientStart: string;
  genreGradientEnd: string;
  durationLabel: string;
  playCountLabel: string;
  likesCountLabel: string;
}

/* =========================
   COMPONENTE
========================= */
@Component({
  selector: 'app-gestion-canciones-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, AdminSidebarComponent],
  templateUrl: './gestion-canciones.page.html',
  styleUrl: './gestion-canciones.page.scss',
})
export class GestionCancionesPage {
  /* =========================
     STORAGE KEYS
  ========================== */
  private readonly SONGS_KEY = 'ruby_songs';
  private readonly ARTISTS_KEY = 'ruby_artists';
  private readonly ALBUMS_KEY = 'ruby_albums';
  private readonly GENRES_KEY = 'ruby_genres';

  /* =========================
     ICONOS
  ========================== */
  readonly Menu = Menu;
  readonly Search = Search;
  readonly Plus = Plus;
  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;
  readonly Eye = Eye;
  readonly Heart = Heart;
  readonly Play = Play;
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
     SELECCIÓN
  ========================== */
  readonly selectedSong = signal<SongView | null>(null);

  /* =========================
     FORM CREATE
  ========================== */
  readonly createSongTitle = signal('');
  readonly createSongArtistId = signal('');
  readonly createSongAlbumId = signal('');
  readonly createSongCoverUrl = signal('');
  readonly createSongAudioUrl = signal('');
  readonly createSongDurationSeconds = signal('');
  readonly createSongLyrics = signal('');
  readonly createSongGenreId = signal('');
  readonly createGenreFilterQuery = signal('');

  /* =========================
     FORM EDIT
  ========================== */
  readonly editSongTitle = signal('');
  readonly editSongCoverUrl = signal('');
  readonly editSongAudioUrl = signal('');
  readonly editSongDurationSeconds = signal('');
  readonly editSongLyrics = signal('');
  readonly editSongGenreId = signal('');
  readonly editGenreFilterQuery = signal('');

  /* =========================
     DATA BASE
  ========================== */
  readonly artists = signal<Artist[]>(this.loadArtists());
  readonly albums = signal<Album[]>(this.loadAlbums());
  readonly genres = signal<Genre[]>(this.loadGenres());
  readonly songs = signal<Song[]>(this.loadSongs());

  constructor() {
    this.syncRelatedCountsFromSongs(this.songs());
  }

  /* =========================
     COMPUTED
  ========================== */
  readonly availableArtists = computed(() => {
    return [...this.artists()].sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly filteredAlbumsForCreate = computed(() => {
    const artistId = this.createSongArtistId().trim();

    if (!artistId) {
      return [];
    }

    return this.albums()
      .filter((album) => album.artistId === artistId)
      .sort((a, b) => a.title.localeCompare(b.title));
  });

  readonly filteredGenresForCreate = computed(() => {
    const query = this.normalize(this.createGenreFilterQuery());

    if (!query) {
      return [...this.genres()].sort((a, b) => a.name.localeCompare(b.name));
    }

    return this.genres()
      .filter((genre) => this.normalize(genre.name).includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly filteredGenresForEdit = computed(() => {
    const query = this.normalize(this.editGenreFilterQuery());

    if (!query) {
      return [...this.genres()].sort((a, b) => a.name.localeCompare(b.name));
    }

    return this.genres()
      .filter((genre) => this.normalize(genre.name).includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly songViews = computed<SongView[]>(() => {
    const artists = this.artists();
    const albums = this.albums();
    const genres = this.genres();

    return this.songs()
      .map((song) => {
        const artist = artists.find((item) => item.id === song.artistId);
        const album = song.albumId
          ? albums.find((item) => item.id === song.albumId)
          : null;
        const genre = genres.find((item) => item.id === song.genreId);

        return {
          ...song,
          artistName: artist?.name ?? 'Artista no disponible',
          artistPhotoUrl:
            artist?.photoUrl ??
            'https://ui-avatars.com/api/?name=Artist&background=e5e7eb&color=111&bold=true',
          albumTitle: album?.title ?? 'Single',
          genreName: genre?.name ?? 'Género no disponible',
          genreGradientStart: genre?.gradientStart ?? '#111111',
          genreGradientEnd: genre?.gradientEnd ?? '#4b4b4b',
          durationLabel: this.formatSecondsToMinutes(song.durationSeconds),
          playCountLabel: this.formatCompactCount(song.playCount),
          likesCountLabel: this.formatCompactCount(song.likesCount),
        };
      })
      .sort(
        (a, b) =>
          this.parseDateToTime(b.createdAt) - this.parseDateToTime(a.createdAt)
      );
  });

  readonly filteredSongs = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();

    if (!query) {
      return this.songViews();
    }

    return this.songViews().filter(
      (song) =>
        song.title.toLowerCase().includes(query) ||
        song.artistName.toLowerCase().includes(query)
    );
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
    const storedSongs = localStorage.getItem(this.SONGS_KEY);

    if (storedSongs) {
      try {
        return JSON.parse(storedSongs) as Song[];
      } catch {
        localStorage.removeItem(this.SONGS_KEY);
      }
    }

    const artists = this.loadArtists();
    const albums = this.loadAlbums();
    const genres = this.loadGenres();

    if (artists.length === 0 || genres.length === 0) {
      return [];
    }

    const getArtistIdByNameOrFallback = (
      preferredName: string,
      fallbackIndex = 0
    ): string => {
      const preferredArtist = artists.find(
        (artist) => this.normalize(artist.name) === this.normalize(preferredName)
      );

      if (preferredArtist) return preferredArtist.id;
      return artists[fallbackIndex]?.id ?? artists[0].id;
    };

    const getAlbumIdByTitleOrNull = (preferredTitle: string): string | null => {
      const album = albums.find(
        (item) => this.normalize(item.title) === this.normalize(preferredTitle)
      );

      return album?.id ?? null;
    };

    const getGenreIdByNameOrFallback = (
      preferredName: string,
      fallbackIndex = 0
    ): string => {
      const preferredGenre = genres.find(
        (genre) => this.normalize(genre.name) === this.normalize(preferredName)
      );

      if (preferredGenre) return preferredGenre.id;
      return genres[fallbackIndex]?.id ?? genres[0].id;
    };

    const baseSongs: Song[] = [

    ];

    localStorage.setItem(this.SONGS_KEY, JSON.stringify(baseSongs));
    return baseSongs;
  }

  private persistSongs(songs: Song[]): void {
    localStorage.setItem(this.SONGS_KEY, JSON.stringify(songs));
    this.songs.set(songs);
  }

  private persistAlbums(albums: Album[]): void {
    localStorage.setItem(this.ALBUMS_KEY, JSON.stringify(albums));
    this.albums.set(albums);
  }

  private persistGenres(genres: Genre[]): void {
    localStorage.setItem(this.GENRES_KEY, JSON.stringify(genres));
    this.genres.set(genres);
  }

  private syncRelatedCountsFromSongs(songs: Song[]): void {
    const updatedGenres = this.genres().map((genre) => {
      const count = songs.filter((song) => song.genreId === genre.id).length;

      return {
        ...genre,
        count,
      };
    });

    const updatedAlbums = this.albums().map((album) => {
      const songsCount = songs.filter((song) => song.albumId === album.id).length;

      return {
        ...album,
        songsCount,
      };
    });

    this.persistGenres(updatedGenres);
    this.persistAlbums(updatedAlbums);
  }

  private applySongChanges(songs: Song[]): void {
    this.persistSongs(songs);
    this.syncRelatedCountsFromSongs(songs);
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

  private formatSecondsToMinutes(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  private formatCompactCount(value: number): string {
    if (value >= 1_000_000) {
      const formatted = value / 1_000_000;
      return `${formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1)} M`;
    }

    if (value >= 1_000) {
      const formatted = value / 1_000;
      return `${formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1)} K`;
    }

    return `${value}`;
  }

  private existsSongTitle(
    title: string,
    artistId: string,
    excludeId?: string
  ): boolean {
    const normalizedTitle = this.normalize(title);

    return this.songs().some(
      (song) =>
        this.normalize(song.title) === normalizedTitle &&
        song.artistId === artistId &&
        song.id !== excludeId
    );
  }

  private resetCreateForm(): void {
    this.createSongTitle.set('');
    this.createSongArtistId.set('');
    this.createSongAlbumId.set('');
    this.createSongCoverUrl.set('');
    this.createSongAudioUrl.set('');
    this.createSongDurationSeconds.set('');
    this.createSongLyrics.set('');
    this.createSongGenreId.set('');
    this.createGenreFilterQuery.set('');
  }

  private resetEditForm(): void {
    this.editSongTitle.set('');
    this.editSongCoverUrl.set('');
    this.editSongAudioUrl.set('');
    this.editSongDurationSeconds.set('');
    this.editSongLyrics.set('');
    this.editSongGenreId.set('');
    this.editGenreFilterQuery.set('');
  }

  /* =========================
     UI HELPERS
  ========================== */
  onCreateArtistChange(artistId: string): void {
    this.createSongArtistId.set(artistId);
    this.createSongAlbumId.set('');
  }

  /* =========================
     MODALES
  ========================== */
  openCreateModal(): void {
    this.resetCreateForm();
    this.isCreateModalOpen.set(true);
  }

  openEditModal(song: SongView): void {
    this.selectedSong.set(song);

    this.editSongTitle.set(song.title);
    this.editSongCoverUrl.set(song.coverUrl);
    this.editSongAudioUrl.set(song.audioUrl);
    this.editSongDurationSeconds.set(String(song.durationSeconds));
    this.editSongLyrics.set(song.lyrics ?? '');
    this.editSongGenreId.set(song.genreId);
    this.editGenreFilterQuery.set('');

    this.isEditModalOpen.set(true);
  }

  openDetailModal(song: SongView): void {
    this.selectedSong.set(song);
    this.isDetailModalOpen.set(true);
  }

  openDeleteModal(song: SongView): void {
    this.selectedSong.set(song);
    this.isDeleteModalOpen.set(true);
  }

  /* =========================
     CREATE
  ========================== */
  createSong(): void {
    const title = this.createSongTitle().trim();
    const artistId = this.createSongArtistId().trim();
    const albumIdValue = this.createSongAlbumId().trim();
    const coverUrl = this.createSongCoverUrl().trim();
    const audioUrl = this.createSongAudioUrl().trim();
    const durationValue = this.createSongDurationSeconds().trim();
    const genreId = this.createSongGenreId().trim();
    const lyrics = this.createSongLyrics().trim();

    if (
      !title ||
      !artistId ||
      !coverUrl ||
      !audioUrl ||
      !durationValue ||
      !genreId
    ) {
      return;
    }

    const durationSeconds = Number(durationValue);

    if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
      return;
    }

    const artistExists = this.artists().some((artist) => artist.id === artistId);
    if (!artistExists) {
      return;
    }

    const genreExists = this.genres().some((genre) => genre.id === genreId);
    if (!genreExists) {
      return;
    }

    const albumId = albumIdValue || null;

    if (albumId) {
      const album = this.albums().find((item) => item.id === albumId);

      if (!album || album.artistId !== artistId) {
        return;
      }
    }

    if (this.existsSongTitle(title, artistId)) {
      return;
    }

    const newSong: Song = {
      id: crypto.randomUUID(),
      title,
      artistId,
      albumId,
      genreId,
      coverUrl,
      audioUrl,
      durationSeconds,
      lyrics: lyrics || null,
      playCount: 0,
      likesCount: 0,
      createdAt: this.getTodayFormatted(),
    };

    this.applySongChanges([newSong, ...this.songs()]);
    this.closeAllModals();
  }

  /* =========================
     EDIT
  ========================== */
  saveSongEdit(): void {
    const current = this.selectedSong();

    if (!current) {
      return;
    }

    const title = this.editSongTitle().trim();
    const coverUrl = this.editSongCoverUrl().trim();
    const audioUrl = this.editSongAudioUrl().trim();
    const durationValue = this.editSongDurationSeconds().trim();
    const genreId = this.editSongGenreId().trim();
    const lyrics = this.editSongLyrics().trim();

    if (!title || !coverUrl || !audioUrl || !durationValue || !genreId) {
      return;
    }

    const durationSeconds = Number(durationValue);

    if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
      return;
    }

    const genreExists = this.genres().some((genre) => genre.id === genreId);
    if (!genreExists) {
      return;
    }

    if (this.existsSongTitle(title, current.artistId, current.id)) {
      return;
    }

    const updatedSongs = this.songs().map((song) =>
      song.id === current.id
        ? {
            ...song,
            title,
            coverUrl,
            audioUrl,
            durationSeconds,
            lyrics: lyrics || null,
            genreId,
          }
        : song
    );

    this.applySongChanges(updatedSongs);
    this.closeAllModals();
  }

  /* =========================
     DELETE
  ========================== */
  confirmDeleteSong(): void {
    const current = this.selectedSong();

    if (!current) {
      return;
    }

    const updatedSongs = this.songs().filter((song) => song.id !== current.id);

    this.applySongChanges(updatedSongs);
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

    this.selectedSong.set(null);

    this.resetCreateForm();
    this.resetEditForm();
  }
}