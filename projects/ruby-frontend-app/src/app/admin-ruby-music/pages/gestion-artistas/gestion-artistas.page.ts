import { Component, computed, ElementRef, signal, ViewChild } from '@angular/core';
import {
  LucideAngularModule,
  Menu, Plus, Search, Eye, Pencil, Trash2, X,
  Crown, Star, ChevronDown, Check, TriangleAlert, UserRound,
} from 'lucide-angular';
import { AdminSidebarComponent } from '../../components/admin-sidebar/admin-sidebar.component';

export interface Artist {
  id: string;
  name: string;
  photoUrl: string;
  bio: string;
  isTop: boolean;
  followers: number;
  monthlyListeners: number;
  registeredAt: string;
}

type FilterMode = 'ALL' | 'TOP';

const MOCK_ARTISTS: Artist[] = [
  {
    id: '1', name: 'Kanye West',
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Kanye_West_at_the_2009_Tribeca_Film_Festival.jpg/440px-Kanye_West_at_the_2009_Tribeca_Film_Festival.jpg',
    bio: 'Artista urbano estadounidense, líder del género hip-hop y trap.',
    isTop: true, followers: 2_500_000, monthlyListeners: 8_500_000, registeredAt: '15/06/2023',
  },
  {
    id: '2', name: 'Sting',
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Sting_2.jpg/440px-Sting_2.jpg',
    bio: 'Músico y compositor inglés, ex vocalista de The Police.',
    isTop: false, followers: 1_200_000, monthlyListeners: 3_800_000, registeredAt: '02/03/2023',
  },
  {
    id: '3', name: 'Joji',
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Joji_-_Head_in_the_Clouds_2019.jpg/440px-Joji_-_Head_in_the_Clouds_2019.jpg',
    bio: 'Cantante y productor japonés-australiano de R&B y lo-fi.',
    isTop: false, followers: 980_000, monthlyListeners: 2_100_000, registeredAt: '19/07/2023',
  },
  {
    id: '4', name: 'Jesse Rutherford',
    photoUrl: 'https://picsum.photos/seed/jesse/200/200',
    bio: 'Vocalista de The Neighbourhood, referente del indie rock oscuro.',
    isTop: false, followers: 540_000, monthlyListeners: 1_300_000, registeredAt: '08/11/2023',
  },
];

@Component({
  selector:    'rm-gestion-artistas-page',
  standalone:  true,
  imports:     [LucideAngularModule, AdminSidebarComponent],
  templateUrl: './gestion-artistas.page.html',
  styleUrl:    './gestion-artistas.page.scss',
})
export class GestionArtistasPage {

  /* ── Icons ─────────────────────────────────────────────────────────── */
  readonly Menu          = Menu;
  readonly Plus          = Plus;
  readonly Search        = Search;
  readonly Eye           = Eye;
  readonly Pencil        = Pencil;
  readonly Trash2        = Trash2;
  readonly X             = X;
  readonly Crown         = Crown;
  readonly Star          = Star;
  readonly ChevronDown   = ChevronDown;
  readonly Check         = Check;
  readonly TriangleAlert = TriangleAlert;
  readonly UserRound     = UserRound;

  /* ── Sidebar ────────────────────────────────────────────────────────── */
  readonly sidebarOpen = signal(false);

  /* ── Data ───────────────────────────────────────────────────────────── */
  private readonly _artists = signal<Artist[]>(structuredClone(MOCK_ARTISTS));

  /* ── Search & filter ────────────────────────────────────────────────── */
  readonly searchQuery  = signal('');
  readonly filterMode   = signal<FilterMode>('ALL');
  readonly filterOpen   = signal(false);

  readonly filteredArtists = computed(() => {
    const q  = this.searchQuery().toLowerCase().trim();
    const fm = this.filterMode();
    return this._artists().filter(a => {
      if (q  && !a.name.toLowerCase().includes(q)) return false;
      if (fm === 'TOP' && !a.isTop)                return false;
      return true;
    });
  });

  filterLabel = computed(() => this.filterMode() === 'ALL' ? 'Todos' : 'Destacados');

  setFilter(mode: FilterMode): void { this.filterMode.set(mode); this.filterOpen.set(false); }

  /* ── Modal: View ────────────────────────────────────────────────────── */
  readonly viewingArtist = signal<Artist | null>(null);
  openViewModal(a: Artist): void  { this.viewingArtist.set(a); }
  closeViewModal(): void          { this.viewingArtist.set(null); }

  /* ── Modal: Create / Edit ───────────────────────────────────────────── */
  readonly modalMode     = signal<'create' | 'edit' | null>(null);
  readonly editingArtist = signal<Artist | null>(null);

  readonly formName     = signal('');
  readonly formPhotoUrl = signal('');
  readonly formBio      = signal('');
  readonly formIsTop    = signal(false);

  readonly formValid = computed(() => this.formName().trim().length > 0);

  openCreateModal(): void {
    this.formName.set(''); this.formPhotoUrl.set('');
    this.formBio.set('');  this.formIsTop.set(false);
    this.editingArtist.set(null);
    this.modalMode.set('create');
  }

  openEditModal(a: Artist): void {
    this.formName.set(a.name);       this.formPhotoUrl.set(a.photoUrl);
    this.formBio.set(a.bio);         this.formIsTop.set(a.isTop);
    this.editingArtist.set(a);
    this.modalMode.set('edit');
  }

  closeModal(): void { this.modalMode.set(null); this.editingArtist.set(null); }

  submitModal(): void {
    if (!this.formValid()) return;
    const now  = new Date();
    const date = `${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`;

    if (this.modalMode() === 'create') {
      const nuevo: Artist = {
        id:              crypto.randomUUID(),
        name:            this.formName().trim(),
        photoUrl:        this.formPhotoUrl().trim(),
        bio:             this.formBio().trim(),
        isTop:           this.formIsTop(),
        followers:       0,
        monthlyListeners: 0,
        registeredAt:   date,
      };
      this._artists.update(list => [nuevo, ...list]);
    } else {
      const target = this.editingArtist();
      if (!target) return;
      this._artists.update(list =>
        list.map(a => a.id === target.id
          ? { ...a, name: this.formName().trim(), photoUrl: this.formPhotoUrl().trim(),
              bio: this.formBio().trim(), isTop: this.formIsTop() }
          : a),
      );
    }
    this.closeModal();
  }

  /* ── Modal: Delete confirm ──────────────────────────────────────────── */
  readonly deletingArtist = signal<Artist | null>(null);
  openDeleteModal(a: Artist): void { this.deletingArtist.set(a); }
  closeDeleteModal(): void         { this.deletingArtist.set(null); }

  confirmDelete(): void {
    const a = this.deletingArtist();
    if (!a) return;
    this._artists.update(list => list.filter(x => x.id !== a.id));
    this.closeDeleteModal();
  }

  /* ── Helpers ────────────────────────────────────────────────────────── */
  anyModalOpen(): boolean {
    return !!this.modalMode() || !!this.viewingArtist() || !!this.deletingArtist();
  }

  formatNum(n: number): string {
    if (n === 0) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toLocaleString('es', { maximumFractionDigits: 1 }) + 'M';
    if (n >= 1_000)     return (n / 1_000).toLocaleString('es',     { maximumFractionDigits: 1 }) + 'K';
    return n.toLocaleString('es');
  }

  formatNumFull(n: number): string {
    return n.toLocaleString('es-ES');
  }

  onImgError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}
