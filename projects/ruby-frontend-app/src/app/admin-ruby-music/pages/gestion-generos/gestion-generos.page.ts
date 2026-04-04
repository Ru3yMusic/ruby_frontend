import {
  Component,
  computed,
  ElementRef,
  signal,
  ViewChild,
  ViewChildren,
  QueryList,
} from '@angular/core';
import { NgStyle } from '@angular/common';
import {
  LucideAngularModule,
  Menu, Plus, Search, Pencil, Trash2, X, Music, TriangleAlert,
} from 'lucide-angular';
import { AdminSidebarComponent } from '../../components/admin-sidebar/admin-sidebar.component';

export interface Genre {
  id: string;
  name: string;
  colorStart: string;
  colorEnd: string;
  songCount: number;
  createdAt: string;
}

const MOCK_GENRES: Genre[] = [
  { id: '1', name: 'Indie',   colorStart: '#6b7280', colorEnd: '#1f2937', songCount: 12, createdAt: '19/02/2026' },
  { id: '2', name: 'Jazz',    colorStart: '#fbbf24', colorEnd: '#f97316', songCount: 22, createdAt: '24/01/2026' },
  { id: '3', name: 'Bachata', colorStart: '#f87171', colorEnd: '#b91c1c', songCount: 31, createdAt: '13/01/2026' },
  { id: '4', name: 'R&B',     colorStart: '#2dd4bf', colorEnd: '#059669', songCount: 9,  createdAt: '21/12/2025' },
];

@Component({
  selector:    'rm-gestion-generos-page',
  standalone:  true,
  imports:     [LucideAngularModule, AdminSidebarComponent, NgStyle],
  templateUrl: './gestion-generos.page.html',
  styleUrl:    './gestion-generos.page.scss',
})
export class GestionGenerosPage {

  /* ── Icons ─────────────────────────────────────────────────────────── */
  readonly Menu          = Menu;
  readonly Plus          = Plus;
  readonly Search        = Search;
  readonly Pencil        = Pencil;
  readonly Trash2        = Trash2;
  readonly X             = X;
  readonly Music         = Music;
  readonly TriangleAlert = TriangleAlert;

  /* ── Color picker refs ──────────────────────────────────────────────── */
  @ViewChild('startPicker') startPickerRef!: ElementRef<HTMLInputElement>;
  @ViewChild('endPicker')   endPickerRef!:   ElementRef<HTMLInputElement>;

  /* ── Sidebar ────────────────────────────────────────────────────────── */
  readonly sidebarOpen = signal(false);

  /* ── Data ───────────────────────────────────────────────────────────── */
  private readonly _genres = signal<Genre[]>(structuredClone(MOCK_GENRES));

  /* ── Search ─────────────────────────────────────────────────────────── */
  readonly searchQuery = signal('');

  readonly filteredGenres = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    return q
      ? this._genres().filter(g => g.name.toLowerCase().includes(q))
      : this._genres();
  });

  /* ── Modal: Create / Edit ───────────────────────────────────────────── */
  readonly modalMode    = signal<'create' | 'edit' | null>(null);
  readonly editingGenre = signal<Genre | null>(null);

  readonly formName       = signal('');
  readonly formColorStart = signal('#ff6b35');
  readonly formColorEnd   = signal('#f7931e');

  readonly gradientPreview = computed(
    () => `linear-gradient(to bottom, ${this.formColorStart()}, ${this.formColorEnd()})`,
  );

  readonly formValid = computed(
    () => this.formName().trim().length > 0,
  );

  openCreateModal(): void {
    this.formName.set('');
    this.formColorStart.set('#ff6b35');
    this.formColorEnd.set('#f7931e');
    this.editingGenre.set(null);
    this.modalMode.set('create');
  }

  openEditModal(genre: Genre): void {
    this.formName.set(genre.name);
    this.formColorStart.set(genre.colorStart);
    this.formColorEnd.set(genre.colorEnd);
    this.editingGenre.set(genre);
    this.modalMode.set('edit');
  }

  closeModal(): void {
    this.modalMode.set(null);
    this.editingGenre.set(null);
  }

  submitModal(): void {
    if (!this.formValid()) return;

    const now = new Date();
    const date = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;

    if (this.modalMode() === 'create') {
      const nuevo: Genre = {
        id:         crypto.randomUUID(),
        name:       this.formName().trim(),
        colorStart: this.formColorStart(),
        colorEnd:   this.formColorEnd(),
        songCount:  0,
        createdAt:  date,
      };
      this._genres.update(list => [nuevo, ...list]);
    } else {
      const target = this.editingGenre();
      if (!target) return;
      this._genres.update(list =>
        list.map(g =>
          g.id === target.id
            ? { ...g, name: this.formName().trim(), colorStart: this.formColorStart(), colorEnd: this.formColorEnd() }
            : g,
        ),
      );
    }
    this.closeModal();
  }

  /* ── Modal: Delete confirm ──────────────────────────────────────────── */
  readonly deletingGenre = signal<Genre | null>(null);

  openDeleteModal(genre: Genre): void { this.deletingGenre.set(genre); }
  closeDeleteModal(): void            { this.deletingGenre.set(null); }

  confirmDelete(): void {
    const g = this.deletingGenre();
    if (!g) return;
    this._genres.update(list => list.filter(x => x.id !== g.id));
    this.closeDeleteModal();
  }

  /* ── Helpers ────────────────────────────────────────────────────────── */
  genreGradient(g: Genre): string {
    return `linear-gradient(to bottom, ${g.colorStart}, ${g.colorEnd})`;
  }

  anyModalOpen(): boolean {
    return !!this.modalMode() || !!this.deletingGenre();
  }

  openStartPicker(): void { this.startPickerRef.nativeElement.click(); }
  openEndPicker():   void { this.endPickerRef.nativeElement.click(); }
}
