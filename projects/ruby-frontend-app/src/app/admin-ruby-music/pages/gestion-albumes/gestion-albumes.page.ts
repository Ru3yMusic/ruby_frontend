import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AlertTriangle,
  Eye,
  Menu,
  Pencil,
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

/* =========================
   MODELO UI
========================= */
interface AlbumView extends Album {
  artistName: string;
  artistPhotoUrl: string;
}

/* =========================
   COMPONENTE
========================= */
@Component({
  selector: 'app-gestion-albumes-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, AdminSidebarComponent],
  templateUrl: './gestion-albumes.page.html',
  styleUrl: './gestion-albumes.page.scss',
})
export class GestionAlbumesPage implements OnInit {
  /* =========================
     SERVICIOS
  ========================== */
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
  readonly AlertTriangle = AlertTriangle;

  /* =========================
     UI STATE
  ========================== */
  readonly sidebarOpen = signal(false);
  readonly searchQuery = signal('');
  readonly minAlbumReleaseDate = this.getTodayInputDate();
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
  readonly selectedAlbum = signal<AlbumView | null>(null);

  /* =========================
     FORM CREATE
  ========================== */
  readonly createAlbumTitle = signal('');
  readonly createAlbumArtistId = signal('');
  readonly createAlbumCoverUrl = signal('');
  readonly createAlbumReleaseDate = signal('');

  /* =========================
     FORM EDIT
  ========================== */
  readonly editAlbumTitle = signal('');
  readonly editAlbumArtistId = signal('');
  readonly editAlbumCoverUrl = signal('');
  readonly editAlbumReleaseDate = signal('');

  /* =========================
     DATA BASE
  ========================== */
  readonly artists = signal<Artist[]>([]);
  readonly albums = signal<Album[]>([]);

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

  readonly albumViews = computed<AlbumView[]>(() => {
    const artists = this.artists();
    const albums = this.albums();

    return albums
      .map((album) => {
        const artist = artists.find((item) => item.id === album.artistId);

        return {
          ...album,
          artistName: artist?.name ?? 'Artista no disponible',
          artistPhotoUrl:
            artist?.photoUrl ??
            'https://ui-avatars.com/api/?name=Artist&background=e5e7eb&color=111&bold=true',
        };
      })
      .sort(
        (a, b) =>
          this.parseDateToTime(b.releaseDate) - this.parseDateToTime(a.releaseDate)
      );
  });

  readonly filteredAlbums = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();

    if (!query) {
      return this.albumViews();
    }

    return this.albumViews().filter(
      (album) =>
        album.title.toLowerCase().includes(query) ||
        album.artistName.toLowerCase().includes(query)
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
      releaseDate: this.mapDate(a.releaseDate),
      songsCount: a.songCount ?? 0,
      totalStreams: `${a.totalStreams ?? 0} streams`,
      createdAt: this.mapDate(a.releaseDate),
    }));
  }

  private mapDate(isoDate?: string): string {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (!Number.isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return isoDate;
  }

  /* =========================
     CARGA / RECARGA
  ========================== */
  private reloadData(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      artists: this.artistsApi.listArtists(),
      albums: this.albumsApi.listAlbums(),
    }).subscribe({
      next: ({ artists, albums }) => {
        this.artists.set(this.mapArtists(artists.content ?? []));
        this.albums.set(this.mapAlbums(albums.content ?? []));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al cargar los álbumes');
        this.loading.set(false);
      },
    });
  }

  private reloadAlbums(): void {
    this.loading.set(true);
    this.error.set(null);

    this.albumsApi.listAlbums().subscribe({
      next: (albums) => {
        this.albums.set(this.mapAlbums(albums.content ?? []));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al recargar los álbumes');
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

  private getTodayInputDate(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private formatInputDateToDisplay(value: string): string {
    const [year, month, day] = value.split('-');

    if (!year || !month || !day) {
      return '';
    }

    return `${day}/${month}/${year}`;
  }

  private formatDisplayDateToInput(value: string): string {
    const [day, month, year] = value.split('/');

    if (!day || !month || !year) {
      return '';
    }

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
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

  private isPastDisplayDate(value: string): boolean {
    const inputDate = this.formatDisplayDateToInput(value);

    if (!inputDate) {
      return false;
    }

    return inputDate < this.minAlbumReleaseDate;
  }

  isEditReleaseDateLocked(): boolean {
    const current = this.selectedAlbum();

    if (!current) {
      return false;
    }

    return this.isPastDisplayDate(current.releaseDate);
  }

  private existsAlbumTitle(
    title: string,
    artistId: string,
    excludeId?: string
  ): boolean {
    const normalizedTitle = this.normalize(title);

    return this.albums().some(
      (album) =>
        this.normalize(album.title) === normalizedTitle &&
        album.artistId === artistId &&
        album.id !== excludeId
    );
  }

  private resetCreateForm(): void {
    this.createAlbumTitle.set('');
    this.createAlbumArtistId.set('');
    this.createAlbumCoverUrl.set('');
    this.createAlbumReleaseDate.set('');
  }

  private resetEditForm(): void {
    this.editAlbumTitle.set('');
    this.editAlbumArtistId.set('');
    this.editAlbumCoverUrl.set('');
    this.editAlbumReleaseDate.set('');
  }

  /* =========================
     MODALES
  ========================== */
  openCreateModal(): void {
    this.resetCreateForm();
    this.isCreateModalOpen.set(true);
  }

  openEditModal(album: AlbumView): void {
    this.selectedAlbum.set(album);

    this.editAlbumTitle.set(album.title);
    this.editAlbumArtistId.set(album.artistId);
    this.editAlbumCoverUrl.set(album.coverUrl);
    this.editAlbumReleaseDate.set(this.formatDisplayDateToInput(album.releaseDate));

    this.isEditModalOpen.set(true);
  }

  openDetailModal(album: AlbumView): void {
    this.selectedAlbum.set(album);
    this.isDetailModalOpen.set(true);
  }

  openDeleteModal(album: AlbumView): void {
    this.selectedAlbum.set(album);
    this.isDeleteModalOpen.set(true);
  }

  /* =========================
     CREATE
  ========================== */
  createAlbum(): void {
    const title = this.createAlbumTitle().trim();
    const artistId = this.createAlbumArtistId().trim();
    const coverUrl = this.createAlbumCoverUrl().trim();
    const releaseDateInput = this.createAlbumReleaseDate().trim();

    if (!title || !artistId || !coverUrl || !releaseDateInput) return;
    if (releaseDateInput < this.minAlbumReleaseDate) return;

    const artistExists = this.artists().some((artist) => artist.id === artistId);
    if (!artistExists) return;

    if (this.existsAlbumTitle(title, artistId)) return;

    this.loading.set(true);
    this.error.set(null);

    this.albumsApi.createAlbum({
      title,
      artistId,
      coverUrl,
      releaseDate: releaseDateInput,
    }).subscribe({
      next: () => {
        this.closeAllModals();
        this.reloadAlbums();
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al crear el álbum');
        this.loading.set(false);
      },
    });
  }

  /* =========================
     EDIT
  ========================== */
  saveAlbumEdit(): void {
    const current = this.selectedAlbum();
    if (!current) return;

    const title = this.editAlbumTitle().trim();
    const artistId = this.editAlbumArtistId().trim();
    const coverUrl = this.editAlbumCoverUrl().trim();

    if (!title || !artistId || !coverUrl) return;

    const artistExists = this.artists().some((artist) => artist.id === artistId);
    if (!artistExists) return;

    if (this.existsAlbumTitle(title, artistId, current.id)) return;

    const isReleaseDateLocked = this.isEditReleaseDateLocked();

    const finalReleaseDate = isReleaseDateLocked
      ? this.formatDisplayDateToInput(current.releaseDate)
      : this.editAlbumReleaseDate().trim();

    if (!isReleaseDateLocked && !finalReleaseDate) return;
    if (!isReleaseDateLocked && finalReleaseDate < this.minAlbumReleaseDate) return;

    this.loading.set(true);
    this.error.set(null);

    this.albumsApi.updateAlbum(current.id, {
      title,
      artistId,
      coverUrl,
      releaseDate: finalReleaseDate,
    }).subscribe({
      next: () => {
        this.closeAllModals();
        this.reloadAlbums();
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al actualizar el álbum');
        this.loading.set(false);
      },
    });
  }

  /* =========================
     DELETE
  ========================== */
  confirmDeleteAlbum(): void {
    const current = this.selectedAlbum();
    if (!current) return;

    this.loading.set(true);
    this.error.set(null);

    this.albumsApi.deleteAlbum(current.id).subscribe({
      next: () => {
        this.closeAllModals();
        this.reloadAlbums();
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al eliminar el álbum');
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

    this.selectedAlbum.set(null);

    this.resetCreateForm();
    this.resetEditForm();
  }
}
