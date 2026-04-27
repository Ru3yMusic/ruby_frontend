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
  /** Display string for the UI: "DD/MM/YYYY hh:mm:ss AM/PM" */
  releaseDateTime: string;
  /** Raw ISO from the SDK ("2026-04-26T16:22:00") — sort + form load use this */
  releaseDateTimeIso: string;
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
  readonly minAlbumReleaseDateTime = signal(this.getTodayInputDate());
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
  readonly createAlbumReleaseDateTime = signal('');

  /* =========================
     FORM EDIT
  ========================== */
  readonly editAlbumTitle = signal('');
  readonly editAlbumArtistId = signal('');
  readonly editAlbumCoverUrl = signal('');
  readonly editAlbumReleaseDateTime = signal('');

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
      .sort((a, b) => b.releaseDateTimeIso.localeCompare(a.releaseDateTimeIso));
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
      releaseDateTime: this.mapDate(a.releaseDateTime),
      releaseDateTimeIso: a.releaseDateTime ?? '',
      songsCount: a.songCount ?? 0,
      totalStreams: `${a.totalStreams ?? 0} streams`,
      createdAt: this.mapDate(a.releaseDateTime),
    }));
  }

  private mapDate(isoDate?: string): string {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (!Number.isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const hours24 = d.getHours();
      const period = hours24 >= 12 ? 'PM' : 'AM';
      const hours12 = String(hours24 % 12 || 12).padStart(2, '0');
      return `${day}/${month}/${year} ${hours12}:${minutes} ${period}`;
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

  /**
   * Earliest valid release moment for the form: now + 1 minute, with seconds
   * truncated to keep the input format aligned (yyyy-MM-ddTHH:mm). Adding the
   * minute prevents users from "agendar para ya mismo" — the scheduler runs
   * every 60s, so anything before now+1min would publish immediately and
   * defeat the purpose of scheduling.
   */
  private getTodayInputDate(): string {
    const date = new Date(Date.now() + 60_000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  private refreshMinReleaseDateTime(): void {
    this.minAlbumReleaseDateTime.set(this.getTodayInputDate());
  }

  private isPastIso(iso: string): boolean {
    if (!iso) return false;
    return iso < this.minAlbumReleaseDateTime();
  }

  isEditReleaseDateTimeLocked(): boolean {
    const current = this.selectedAlbum();

    if (!current) {
      return false;
    }

    return this.isPastIso(current.releaseDateTimeIso);
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
    this.createAlbumReleaseDateTime.set('');
  }

  private resetEditForm(): void {
    this.editAlbumTitle.set('');
    this.editAlbumArtistId.set('');
    this.editAlbumCoverUrl.set('');
    this.editAlbumReleaseDateTime.set('');
  }

  /* =========================
     MODALES
  ========================== */
  openCreateModal(): void {
    this.refreshMinReleaseDateTime();
    this.resetCreateForm();
    this.isCreateModalOpen.set(true);
  }

  openEditModal(album: AlbumView): void {
    this.refreshMinReleaseDateTime();
    this.selectedAlbum.set(album);

    this.editAlbumTitle.set(album.title);
    this.editAlbumArtistId.set(album.artistId);
    this.editAlbumCoverUrl.set(album.coverUrl);
    // ISO from SDK has seconds ("2026-04-26T16:22:00"). Input is minute-precision,
    // so slice to "yyyy-MM-ddTHH:mm" to keep the value format aligned.
    this.editAlbumReleaseDateTime.set((album.releaseDateTimeIso || '').slice(0, 16));

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
    const releaseDateTimeInput = this.createAlbumReleaseDateTime().trim();

    if (!title || !artistId || !coverUrl || !releaseDateTimeInput) return;
    this.refreshMinReleaseDateTime();
    if (releaseDateTimeInput < this.minAlbumReleaseDateTime()) {
      this.error.set('La fecha de lanzamiento debe ser al menos 1 minuto después de la hora actual.');
      return;
    }

    const artistExists = this.artists().some((artist) => artist.id === artistId);
    if (!artistExists) return;

    if (this.existsAlbumTitle(title, artistId)) return;

    this.loading.set(true);
    this.error.set(null);

    this.albumsApi.createAlbum({
      title,
      artistId,
      coverUrl,
      releaseDateTime: releaseDateTimeInput,
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

    const isReleaseDateTimeLocked = this.isEditReleaseDateTimeLocked();

    const finalReleaseDateTime = isReleaseDateTimeLocked
      ? current.releaseDateTimeIso
      : this.editAlbumReleaseDateTime().trim();

    if (!isReleaseDateTimeLocked && !finalReleaseDateTime) return;
    if (!isReleaseDateTimeLocked) {
      this.refreshMinReleaseDateTime();
      if (finalReleaseDateTime < this.minAlbumReleaseDateTime()) {
        this.error.set('La fecha de lanzamiento debe ser al menos 1 minuto después de la hora actual.');
        return;
      }
    }

    this.loading.set(true);
    this.error.set(null);

    this.albumsApi.updateAlbum(current.id, {
      title,
      artistId,
      coverUrl,
      releaseDateTime: finalReleaseDateTime,
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
