import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
export class GestionCancionesPage implements OnInit {
  /* =========================
     SERVICIOS
  ========================== */
  private readonly songsApi = inject(SongsApi);
  private readonly artistsApi = inject(ArtistsApi);
  private readonly albumsApi = inject(AlbumsApi);
  private readonly genresApi = inject(GenresApi);

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
  readonly artists = signal<Artist[]>([]);
  readonly albums = signal<Album[]>([]);
  readonly genres = signal<Genre[]>([]);
  readonly songs = signal<Song[]>([]);

  /* =========================
     LIFECYCLE
  ========================== */
  ngOnInit(): void {
    this.reloadData();
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
     MAPPERS SDK → LOCAL
  ========================== */
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

  private mapGenres(sdkGenres: GenreResponse[]): Genre[] {
    return sdkGenres.map((g) => ({
      id: g.id ?? '',
      name: g.name ?? '',
      count: g.songCount ?? 0,
      createdAt: g.createdAt ?? '',
      gradientStart: g.gradientStart ?? '#111111',
      gradientEnd: g.gradientEnd ?? '#4b4b4b',
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

  /* =========================
     CARGA / RECARGA
  ========================== */
  private reloadData(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      songs: this.songsApi.listSongs(),
      artists: this.artistsApi.listArtists(),
      albums: this.albumsApi.listAlbums(),
      genres: this.genresApi.listGenres(),
    }).subscribe({
      next: ({ songs, artists, albums, genres }) => {
        this.artists.set(this.mapArtists(artists.content ?? []));
        this.albums.set(this.mapAlbums(albums.content ?? []));
        this.genres.set(this.mapGenres(genres));
        this.songs.set(this.mapSongs(songs.content ?? []));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al cargar las canciones');
        this.loading.set(false);
      },
    });
  }

  private reloadSongs(): void {
    this.loading.set(true);
    this.error.set(null);

    this.songsApi.listSongs().subscribe({
      next: (page) => {
        this.songs.set(this.mapSongs(page.content ?? []));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al recargar las canciones');
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

    if (!title || !artistId || !coverUrl || !audioUrl || !durationValue || !genreId) return;

    const durationSeconds = Number(durationValue);
    if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) return;

    const artistExists = this.artists().some((artist) => artist.id === artistId);
    if (!artistExists) return;

    const genreExists = this.genres().some((genre) => genre.id === genreId);
    if (!genreExists) return;

    const albumId = albumIdValue || null;
    if (albumId) {
      const album = this.albums().find((item) => item.id === albumId);
      if (!album || album.artistId !== artistId) return;
    }

    if (this.existsSongTitle(title, artistId)) return;

    this.loading.set(true);
    this.error.set(null);

    this.songsApi.createSong({
      title,
      artistId,
      albumId: albumId ?? undefined,
      coverUrl,
      audioUrl,
      duration: durationSeconds,
      lyrics: lyrics || undefined,
      genreIds: [genreId],
    }).subscribe({
      next: () => {
        this.closeAllModals();
        this.reloadSongs();
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al crear la canción');
        this.loading.set(false);
      },
    });
  }

  /* =========================
     EDIT
  ========================== */
  saveSongEdit(): void {
    const current = this.selectedSong();
    if (!current) return;

    const title = this.editSongTitle().trim();
    const coverUrl = this.editSongCoverUrl().trim();
    const audioUrl = this.editSongAudioUrl().trim();
    const durationValue = this.editSongDurationSeconds().trim();
    const genreId = this.editSongGenreId().trim();
    const lyrics = this.editSongLyrics().trim();

    if (!title || !coverUrl || !audioUrl || !durationValue || !genreId) return;

    const durationSeconds = Number(durationValue);
    if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) return;

    const genreExists = this.genres().some((genre) => genre.id === genreId);
    if (!genreExists) return;

    if (this.existsSongTitle(title, current.artistId, current.id)) return;

    this.loading.set(true);
    this.error.set(null);

    this.songsApi.updateSong(current.id, {
      title,
      coverUrl,
      audioUrl,
      duration: durationSeconds,
      lyrics: lyrics || undefined,
      genreIds: [genreId],
    }).subscribe({
      next: () => {
        this.closeAllModals();
        this.reloadSongs();
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al actualizar la canción');
        this.loading.set(false);
      },
    });
  }

  /* =========================
     DELETE
  ========================== */
  confirmDeleteSong(): void {
    const current = this.selectedSong();
    if (!current) return;

    this.loading.set(true);
    this.error.set(null);

    this.songsApi.deleteSong(current.id).subscribe({
      next: () => {
        this.closeAllModals();
        this.reloadSongs();
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al eliminar la canción');
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

    this.selectedSong.set(null);

    this.resetCreateForm();
    this.resetEditForm();
  }
}
