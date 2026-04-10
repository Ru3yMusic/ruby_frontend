import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { Menu, Music4, Pencil, Plus, Search, Trash2 } from 'lucide-angular';

import { LucideAngularModule } from 'lucide-angular';
import { AdminSidebarComponent } from '../../components/admin-sidebar/admin-sidebar.component';

/* =========================
   MODELO DE GÉNERO
========================== */
interface Genre {
  id: string;
  name: string;
  count: number;
  createdAt: string;
  gradientStart: string;
  gradientEnd: string;
}

@Component({
  selector: 'app-gestion-generos-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, AdminSidebarComponent],
  templateUrl: './gestion-generos.page.html',
  styleUrl: './gestion-generos.page.scss',
})
export class GestionGenerosPage {
  /* =========================
     STORAGE KEY
  ========================== */
  private readonly GENRES_KEY = 'ruby_genres';

  /* =========================
     ICONOS
  ========================== */
  readonly Menu = Menu;
  readonly Search = Search;
  readonly Plus = Plus;
  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;
  readonly Music4 = Music4;

  /* =========================
     ESTADO GENERAL UI
  ========================== */
  readonly sidebarOpen = signal(false);
  readonly searchQuery = signal('');

  /* =========================
     MODALES
  ========================== */
  readonly isCreateModalOpen = signal(false);
  readonly isEditModalOpen = signal(false);
  readonly isDeleteModalOpen = signal(false);

  /* =========================
     GÉNERO SELECCIONADO
  ========================== */
  readonly selectedGenre = signal<Genre | null>(null);

  /* =========================
     FORM CREATE
  ========================== */
  readonly createGenreName = signal('');
  readonly createGradientStart = signal('#FF8A8A');
  readonly createGradientEnd = signal('#0C3C4C');

  /* =========================
     FORM EDIT
  ========================== */
  readonly editGenreName = signal('');
  readonly editGradientStart = signal('#FF8A8A');
  readonly editGradientEnd = signal('#0C3C4C');

  /* =========================
     DATA PERSISTIDA
  ========================== */
  readonly genres = signal<Genre[]>(this.loadGenres());

  /* =========================
     COMPUTED: FILTRADO
  ========================== */
  readonly filteredGenres = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();

    if (!query) {
      return this.genres();
    }

    return this.genres().filter((genre) =>
      genre.name.toLowerCase().includes(query)
    );
  });

  /* =========================
     COMPUTED: OVERLAY MODALES
  ========================== */
  readonly anyModalOpen = computed(() => {
    return (
      this.isCreateModalOpen() ||
      this.isEditModalOpen() ||
      this.isDeleteModalOpen()
    );
  });

  /* =========================
     STORAGE
  ========================== */
  private loadGenres(): Genre[] {
    const storedGenres = localStorage.getItem(this.GENRES_KEY);

    if (storedGenres) {
      try {
        return JSON.parse(storedGenres) as Genre[];
      } catch {
        localStorage.removeItem(this.GENRES_KEY);
      }
    }

    const baseGenres: Genre[] = [
      
    ];

    localStorage.setItem(this.GENRES_KEY, JSON.stringify(baseGenres));
    return baseGenres;
  }

  private persistGenres(genres: Genre[]): void {
    localStorage.setItem(this.GENRES_KEY, JSON.stringify(genres));
    this.genres.set(genres);
  }

  /* =========================
     HELPERS
  ========================== */
  private formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private resetCreateForm(): void {
    this.createGenreName.set('');
    this.createGradientStart.set('#FF8A8A');
    this.createGradientEnd.set('#0C3C4C');
  }

  private resetEditForm(): void {
    this.editGenreName.set('');
    this.editGradientStart.set('#FF8A8A');
    this.editGradientEnd.set('#0C3C4C');
  }

  private normalizeGenreName(name: string): string {
    return name.trim().toLowerCase();
  }

  private existsGenreName(name: string, excludeId?: string): boolean {
    const normalizedName = this.normalizeGenreName(name);

    return this.genres().some(
      (genre) =>
        this.normalizeGenreName(genre.name) === normalizedName &&
        genre.id !== excludeId
    );
  }

  /* =========================
     MODAL: CREAR
  ========================== */
  openCreateModal(): void {
    this.resetCreateForm();
    this.isCreateModalOpen.set(true);
  }

  createGenre(): void {
    const name = this.createGenreName().trim();
    const gradientStart = this.createGradientStart();
    const gradientEnd = this.createGradientEnd();

    if (!name) {
      return;
    }

    if (name.length > 100) {
      return;
    }

    if (this.existsGenreName(name)) {
      return;
    }

    const newGenre: Genre = {
      id: crypto.randomUUID(),
      name,
      count: 0,
      createdAt: this.formatDate(new Date()),
      gradientStart,
      gradientEnd,
    };

    const updatedGenres = [newGenre, ...this.genres()];
    this.persistGenres(updatedGenres);

    this.closeAllModals();
  }

  /* =========================
     MODAL: EDITAR
  ========================== */
  openEditModal(genre: Genre): void {
    this.selectedGenre.set(genre);

    this.editGenreName.set(genre.name);
    this.editGradientStart.set(genre.gradientStart);
    this.editGradientEnd.set(genre.gradientEnd);

    this.isEditModalOpen.set(true);
  }

  saveGenreEdit(): void {
    const currentGenre = this.selectedGenre();

    if (!currentGenre) {
      return;
    }

    const name = this.editGenreName().trim();
    const gradientStart = this.editGradientStart();
    const gradientEnd = this.editGradientEnd();

    if (!name) {
      return;
    }

    if (name.length > 100) {
      return;
    }

    if (this.existsGenreName(name, currentGenre.id)) {
      return;
    }

    const updatedGenres = this.genres().map((genre) =>
      genre.id === currentGenre.id
        ? {
            ...genre,
            name,
            gradientStart,
            gradientEnd,
          }
        : genre
    );

    this.persistGenres(updatedGenres);
    this.closeAllModals();
  }

  /* =========================
     MODAL: ELIMINAR
  ========================== */
  openDeleteModal(genre: Genre): void {
    this.selectedGenre.set(genre);
    this.isDeleteModalOpen.set(true);
  }

  confirmDeleteGenre(): void {
    const currentGenre = this.selectedGenre();

    if (!currentGenre) {
      return;
    }

    const updatedGenres = this.genres().filter(
      (genre) => genre.id !== currentGenre.id
    );

    this.persistGenres(updatedGenres);
    this.closeAllModals();
  }

  /* =========================
     CIERRE GENERAL MODALES
  ========================== */
  closeAllModals(): void {
    this.isCreateModalOpen.set(false);
    this.isEditModalOpen.set(false);
    this.isDeleteModalOpen.set(false);

    this.selectedGenre.set(null);

    this.resetCreateForm();
    this.resetEditForm();
  }
}