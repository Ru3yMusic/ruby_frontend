import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
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
export class GestionArtistasPage {

  /* =========================
     STORAGE
  ========================== */
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

  /* =========================
     UI STATE
  ========================== */
  readonly sidebarOpen = signal(false);
  readonly searchQuery = signal('');
  readonly topFilter = signal('');

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
  readonly artists = signal<Artist[]>(this.loadArtists());

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
     STORAGE LOGIC
  ========================== */
  private loadArtists(): Artist[] {
    const stored = localStorage.getItem(this.ARTISTS_KEY);

    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        localStorage.removeItem(this.ARTISTS_KEY);
      }
    }

    const base: Artist[] = [
     
    ];

    localStorage.setItem(this.ARTISTS_KEY, JSON.stringify(base));
    return base;
  }

  private persistArtists(artists: Artist[]): void {
    localStorage.setItem(this.ARTISTS_KEY, JSON.stringify(artists));
    this.artists.set(artists);
  }

  /* =========================
     HELPERS
  ========================== */
  private getToday(): string {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

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
    const photo = this.createArtistPhotoUrl().trim();

    if (!name || !photo) return;
    if (this.existsName(name)) return;

    const newArtist: Artist = {
      id: crypto.randomUUID(),
      name,
      photoUrl: photo,
      bio: this.createArtistBio(),
      isTop: this.createArtistIsTop(),
      followersCount: '0 seguidores',
      monthlyListeners: '0 oyentes / mes',
      createdAt: this.getToday(),
    };

    this.persistArtists([newArtist, ...this.artists()]);
    this.closeAllModals();
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

    const updated = this.artists().map((a) =>
      a.id === current.id
        ? {
            ...a,
            name,
            photoUrl: this.editArtistPhotoUrl(),
            bio: this.editArtistBio(),
            isTop: this.editArtistIsTop(),
          }
        : a
    );

    this.persistArtists(updated);
    this.closeAllModals();
  }

  /* =========================
     DELETE
  ========================== */
  confirmDeleteArtist(): void {
    const current = this.selectedArtist();
    if (!current) return;

    const updated = this.artists().filter((a) => a.id !== current.id);
    this.persistArtists(updated);
    this.closeAllModals();
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