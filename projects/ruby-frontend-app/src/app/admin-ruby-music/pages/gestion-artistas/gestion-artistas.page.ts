import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  Eye,
  Menu,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-angular';

import { LucideAngularModule } from 'lucide-angular';
import { AdminSidebarComponent } from '../../components/admin-sidebar/admin-sidebar.component';
import { ArtistResponse, ArtistsApi } from 'lib-ruby-sdks/catalog-service';

/* =========================
   MODELO ARTISTA
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

/* =========================
   COMPONENTE
========================= */
@Component({
  selector: 'app-gestion-artistas-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, AdminSidebarComponent],
  templateUrl: './gestion-artistas.page.html',
  styleUrl: './gestion-artistas.page.scss',
})
export class GestionArtistasPage implements OnInit {

  /* =========================
     SERVICIOS
  ========================== */
  private readonly artistsApi = inject(ArtistsApi);

  /* =========================
     ICONOS
  ========================== */
  readonly Menu = Menu;
  readonly Search = Search;
  readonly Plus = Plus;
  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;
  readonly Eye = Eye;

  /* =========================
     UI STATE
  ========================== */
  readonly sidebarOpen = signal(false);
  readonly searchQuery = signal('');
  readonly topFilter = signal('');
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
  readonly selectedArtist = signal<Artist | null>(null);

  /* =========================
     FORM CREATE
  ========================== */
  readonly createArtistName = signal('');
  readonly createArtistPhotoUrl = signal('');
  readonly createArtistBio = signal('');
  readonly createArtistIsTop = signal(false);

  /* =========================
     FORM EDIT
  ========================== */
  readonly editArtistName = signal('');
  readonly editArtistPhotoUrl = signal('');
  readonly editArtistBio = signal('');
  readonly editArtistIsTop = signal(false);

  /* =========================
     DATA
  ========================== */
  readonly artists = signal<Artist[]>([]);

  /* =========================
     LIFECYCLE
  ========================== */
  ngOnInit(): void {
    this.reloadArtists();
  }

  /* =========================
     COMPUTED
  ========================== */
  readonly filteredArtists = computed(() => {
    let result = [...this.artists()];

    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.topFilter();

    if (query) {
      result = result.filter((artist) =>
        artist.name.toLowerCase().includes(query)
      );
    }

    if (filter === 'TOP') {
      result = result.filter((artist) => artist.isTop);
    }

    return result;
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
     MAPPER SDK → LOCAL
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

  /* =========================
     CARGA / RECARGA
  ========================== */
  private reloadArtists(): void {
    this.loading.set(true);
    this.error.set(null);

    this.artistsApi.listArtists().subscribe({
      next: (page) => {
        this.artists.set(this.mapArtists(page.content ?? []));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al cargar los artistas');
        this.loading.set(false);
      },
    });
  }

  /* =========================
     HELPERS
  ========================== */
  private normalize(text: string): string {
    return text.trim().toLowerCase();
  }

  private existsName(name: string, excludeId?: string): boolean {
    const normalized = this.normalize(name);

    return this.artists().some(
      (a) =>
        this.normalize(a.name) === normalized &&
        a.id !== excludeId
    );
  }

  private resetForms(): void {
    this.createArtistName.set('');
    this.createArtistPhotoUrl.set('');
    this.createArtistBio.set('');
    this.createArtistIsTop.set(false);

    this.editArtistName.set('');
    this.editArtistPhotoUrl.set('');
    this.editArtistBio.set('');
    this.editArtistIsTop.set(false);
  }

  /* =========================
     MODALES
  ========================== */
  openCreateModal(): void {
    this.resetForms();
    this.isCreateModalOpen.set(true);
  }

  openEditModal(artist: Artist): void {
    this.selectedArtist.set(artist);

    this.editArtistName.set(artist.name);
    this.editArtistPhotoUrl.set(artist.photoUrl);
    this.editArtistBio.set(artist.bio);
    this.editArtistIsTop.set(artist.isTop);

    this.isEditModalOpen.set(true);
  }

  openDetailModal(artist: Artist): void {
    this.selectedArtist.set(artist);
    this.isDetailModalOpen.set(true);
  }

  openDeleteModal(artist: Artist): void {
    this.selectedArtist.set(artist);
    this.isDeleteModalOpen.set(true);
  }

  /* =========================
     CREATE
  ========================== */
  createArtist(): void {
    const name = this.createArtistName().trim();
    const photoUrl = this.createArtistPhotoUrl().trim();

    if (!name || !photoUrl) return;
    if (this.existsName(name)) return;

    this.loading.set(true);
    this.error.set(null);

    this.artistsApi.createArtist({
      name,
      photoUrl,
      bio: this.createArtistBio().trim() || undefined,
      isTop: this.createArtistIsTop(),
    }).subscribe({
      next: () => {
        this.closeAllModals();
        this.reloadArtists();
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al crear el artista');
        this.loading.set(false);
      },
    });
  }

  /* =========================
     EDIT
  ========================== */
  saveArtistEdit(): void {
    const current = this.selectedArtist();
    if (!current) return;

    const name = this.editArtistName().trim();
    if (!name) return;
    if (this.existsName(name, current.id)) return;

    this.loading.set(true);
    this.error.set(null);

    this.artistsApi.updateArtist(current.id, {
      name,
      photoUrl: this.editArtistPhotoUrl().trim() || undefined,
      bio: this.editArtistBio().trim() || undefined,
      isTop: this.editArtistIsTop(),
    }).subscribe({
      next: () => {
        this.closeAllModals();
        this.reloadArtists();
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al actualizar el artista');
        this.loading.set(false);
      },
    });
  }

  /* =========================
     DELETE
  ========================== */
  confirmDeleteArtist(): void {
    const current = this.selectedArtist();
    if (!current) return;

    this.loading.set(true);
    this.error.set(null);

    this.artistsApi.deleteArtist(current.id).subscribe({
      next: () => {
        this.closeAllModals();
        this.reloadArtists();
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al eliminar el artista');
        this.loading.set(false);
      },
    });
  }

  /* =========================
     CLOSE
  ========================== */
  closeAllModals(): void {
    this.isCreateModalOpen.set(false);
    this.isEditModalOpen.set(false);
    this.isDetailModalOpen.set(false);
    this.isDeleteModalOpen.set(false);

    this.selectedArtist.set(null);
    this.resetForms();
  }
}
