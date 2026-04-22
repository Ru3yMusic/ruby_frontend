import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Menu, Music4, Pencil, Plus, Search, Trash2 } from 'lucide-angular';

import { LucideAngularModule } from 'lucide-angular';
import { AdminSidebarComponent } from '../../components/admin-sidebar/admin-sidebar.component';
import { GenreResponse, GenresApi } from 'lib-ruby-sdks/catalog-service';
import { formatShortDate } from '../../../core/utils/date-format';

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
export class GestionGenerosPage implements OnInit {
  /* =========================
     SERVICIOS
  ========================== */
  private readonly genresApi = inject(GenresApi);

  /** Public wrapper so the template can format ISO dates as `d/M/yyyy`. */
  readonly formatShortDate = formatShortDate;

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
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

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
     DATA
  ========================== */
  readonly genres = signal<Genre[]>([]);

  /* =========================
     LIFECYCLE
  ========================== */
  ngOnInit(): void {
    this.reloadGenres();
  }

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
     MAPPER SDK → LOCAL
  ========================== */
  private mapGenres(sdkGenres: GenreResponse[]): Genre[] {
    return sdkGenres.map((g) => ({
      id: g.id ?? '',
      name: g.name ?? '',
      count: g.songCount ?? 0,
      createdAt: g.createdAt ?? '',
      gradientStart: g.gradientStart ?? '#FF8A8A',
      gradientEnd: g.gradientEnd ?? '#0C3C4C',
    }));
  }

  /* =========================
     CARGA / RECARGA
  ========================== */
  private reloadGenres(): void {
    this.loading.set(true);
    this.error.set(null);

    this.genresApi.listGenres().subscribe({
      next: (sdkGenres) => {
        this.genres.set(this.mapGenres(sdkGenres));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al cargar los géneros');
        this.loading.set(false);
      },
    });
  }

  /* =========================
     HELPERS
  ========================== */
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

    if (!name || name.length > 100) return;
    if (this.existsGenreName(name)) return;

    this.loading.set(true);
    this.error.set(null);

    this.genresApi.createGenre({ name, gradientStart, gradientEnd }).subscribe({
      next: () => {
        this.closeAllModals();
        this.reloadGenres();
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al crear el género');
        this.loading.set(false);
      },
    });
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
    if (!currentGenre) return;

    const name = this.editGenreName().trim();
    const gradientStart = this.editGradientStart();
    const gradientEnd = this.editGradientEnd();

    if (!name || name.length > 100) return;
    if (this.existsGenreName(name, currentGenre.id)) return;

    this.loading.set(true);
    this.error.set(null);

    this.genresApi.updateGenre(currentGenre.id, { name, gradientStart, gradientEnd }).subscribe({
      next: () => {
        this.closeAllModals();
        this.reloadGenres();
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al actualizar el género');
        this.loading.set(false);
      },
    });
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
    if (!currentGenre) return;

    this.loading.set(true);
    this.error.set(null);

    this.genresApi.deleteGenre(currentGenre.id).subscribe({
      next: () => {
        this.closeAllModals();
        this.reloadGenres();
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al eliminar el género');
        this.loading.set(false);
      },
    });
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
