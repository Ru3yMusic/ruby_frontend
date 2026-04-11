import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import {
  AlertTriangle,
  Eye,
  Menu,
  Pencil,
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
export class GestionAlbumesPage {
  /* =========================
     STORAGE KEYS
  ========================== */
  private readonly ALBUMS_KEY = 'ruby_albums';
  private readonly ARTISTS_KEY = 'ruby_artists';

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
  readonly artists = signal<Artist[]>(this.loadArtists());
  readonly albums = signal<Album[]>(this.loadAlbums());

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
     STORAGE
  ========================== */
  private loadArtists(): Artist[] {
    const storedArtists = localStorage.getItem(this.ARTISTS_KEY);

    if (!storedArtists) return [];

    try {
      return JSON.parse(storedArtists) as Artist[];
    } catch {
      localStorage.removeItem(this.ARTISTS_KEY);
      return [];
    }
  }

  private loadAlbums(): Album[] {
    const storedAlbums = localStorage.getItem(this.ALBUMS_KEY);

    if (storedAlbums) {
      try {
        return JSON.parse(storedAlbums) as Album[];
      } catch {
        localStorage.removeItem(this.ALBUMS_KEY);
      }
    }

    const artists = this.loadArtists();

    if (artists.length === 0) {
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

    const baseAlbums: Album[] = [
      {
        id: crypto.randomUUID(),
        title: '808s & Heartbreak',
        artistId: getArtistIdByNameOrFallback('Kanye West', 0),
        coverUrl:
          'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=1200&auto=format&fit=crop',
        releaseDate: '23/02/2027',
        songsCount: 15,
        totalStreams: '1.9 M streams',
        createdAt: '23/02/2026',
      },
      {
        id: crypto.randomUUID(),
        title: 'Nectar',
        artistId: getArtistIdByNameOrFallback('Joji', 1),
        coverUrl:
          'https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=1200&auto=format&fit=crop',
        releaseDate: '10/07/2026',
        songsCount: 9,
        totalStreams: '3 M streams',
        createdAt: '10/07/2026',
      },
      {
        id: crypto.randomUUID(),
        title: 'Ten Summoner’s Tales',
        artistId: getArtistIdByNameOrFallback('Sting', 2),
        coverUrl:
          'https://images.unsplash.com/photo-1501612780327-45045538702b?q=80&w=1200&auto=format&fit=crop',
        releaseDate: '15/09/2026',
        songsCount: 7,
        totalStreams: '1.3 M streams',
        createdAt: '15/09/2026',
      },
      {
        id: crypto.randomUUID(),
        title: 'GARAGEB&',
        artistId: getArtistIdByNameOrFallback('Jesse Rutherford', 3),
        coverUrl:
          'https://images.unsplash.com/photo-1487180144351-b8472da7d491?q=80&w=1200&auto=format&fit=crop',
        releaseDate: '22/04/2026',
        songsCount: 12,
        totalStreams: '980 K streams',
        createdAt: '22/04/2026',
      },
    ];

    localStorage.setItem(this.ALBUMS_KEY, JSON.stringify(baseAlbums));
    return baseAlbums;
  }

  private persistAlbums(albums: Album[]): void {
    localStorage.setItem(this.ALBUMS_KEY, JSON.stringify(albums));
    this.albums.set(albums);
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
    const parts = value.split('/').map(Number);

    if (parts.length !== 3) return 0;

    const [day, month, year] = parts;
    return new Date(year, month - 1, day).getTime();
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

    if (!title || !artistId || !coverUrl || !releaseDateInput) {
      return;
    }

    if (releaseDateInput < this.minAlbumReleaseDate) {
      return;
    }

    const artistExists = this.artists().some((artist) => artist.id === artistId);
    if (!artistExists) {
      return;
    }

    if (this.existsAlbumTitle(title, artistId)) {
      return;
    }

    const newAlbum: Album = {
      id: crypto.randomUUID(),
      title,
      artistId,
      coverUrl,
      releaseDate: this.formatInputDateToDisplay(releaseDateInput),
      songsCount: 0,
      totalStreams: '0 streams',
      createdAt: this.getTodayFormatted(),
    };

    this.persistAlbums([newAlbum, ...this.albums()]);
    this.closeAllModals();
  }

  /* =========================
     EDIT
  ========================== */
saveAlbumEdit(): void {
  const current = this.selectedAlbum();

  if (!current) {
    return;
  }

  const title = this.editAlbumTitle().trim();
  const artistId = this.editAlbumArtistId().trim();
  const coverUrl = this.editAlbumCoverUrl().trim();

  if (!title || !artistId || !coverUrl) {
    return;
  }

  const artistExists = this.artists().some((artist) => artist.id === artistId);
  if (!artistExists) {
    return;
  }

  if (this.existsAlbumTitle(title, artistId, current.id)) {
    return;
  }

  const isReleaseDateLocked = this.isEditReleaseDateLocked();

  const finalReleaseDate = isReleaseDateLocked
    ? current.releaseDate
    : this.formatInputDateToDisplay(this.editAlbumReleaseDate().trim());

  if (!isReleaseDateLocked && !this.editAlbumReleaseDate().trim()) {
    return;
  }

  if (!isReleaseDateLocked && this.editAlbumReleaseDate().trim() < this.minAlbumReleaseDate) {
    return;
  }

  const updatedAlbums = this.albums().map((album) =>
    album.id === current.id
      ? {
          ...album,
          title,
          artistId,
          coverUrl,
          releaseDate: finalReleaseDate,
        }
      : album
  );

  this.persistAlbums(updatedAlbums);
  this.closeAllModals();
}

  /* =========================
     DELETE
  ========================== */
  confirmDeleteAlbum(): void {
    const current = this.selectedAlbum();

    if (!current) {
      return;
    }

    const updatedAlbums = this.albums().filter(
      (album) => album.id !== current.id
    );

    this.persistAlbums(updatedAlbums);
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

    this.selectedAlbum.set(null);

    this.resetCreateForm();
    this.resetEditForm();
  }
}