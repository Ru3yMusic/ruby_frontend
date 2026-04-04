import { Component, computed, signal } from '@angular/core';
import {
  LucideAngularModule,
  Menu, Plus, Search, Eye, Pencil, Trash2, X,
  ChevronDown, Check, TriangleAlert, Disc3, UserRound,
} from 'lucide-angular';
import { AdminSidebarComponent } from '../../components/admin-sidebar/admin-sidebar.component';

/* ── Shared artist references (reuses artistas mock) ───────────────────── */
export interface ArtistRef {
  id: string;
  name: string;
  photoUrl: string;
}

export const ALBUM_ARTISTS: ArtistRef[] = [
  { id: 'a1', name: 'Kanye West',           photoUrl: 'https://picsum.photos/seed/kanye/40/40' },
  { id: 'a2', name: 'Sting',                photoUrl: 'https://picsum.photos/seed/sting/40/40' },
  { id: 'a3', name: 'Joji',                 photoUrl: 'https://picsum.photos/seed/joji/40/40' },
  { id: 'a4', name: 'Jesse Rutherford',     photoUrl: 'https://picsum.photos/seed/jesse/40/40' },
  { id: 'a5', name: 'Cigarettes After Sex', photoUrl: 'https://picsum.photos/seed/cigs/40/40' },
  { id: 'a6', name: 'TV Girl',              photoUrl: 'https://picsum.photos/seed/tvgirl/40/40' },
  { id: 'a7', name: 'Patrick Watson',       photoUrl: 'https://picsum.photos/seed/patrick/40/40' },
];

export interface Album {
  id: string;
  title: string;
  artistId: string;
  coverUrl: string;
  releaseDate: string; // YYYY-MM-DD
  songCount: number;
  totalStreams: number;
  registeredAt: string;
}

const MOCK_ALBUMS: Album[] = [
  { id: '1', title: '808s & Heartbreak', artistId: 'a1',
    coverUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/84/Heartbreak_cover.jpg/220px-Heartbreak_cover.jpg',
    releaseDate: '2024-02-23', songCount: 15, totalStreams: 1_900_000, registeredAt: '19/03/2024' },
  { id: '2', title: "X's",              artistId: 'a5',
    coverUrl: 'https://picsum.photos/seed/xs/200/200',
    releaseDate: '2023-03-09', songCount: 10, totalStreams: 3_200_000, registeredAt: '09/03/2023' },
  { id: '3', title: 'Close to Paradise', artistId: 'a7',
    coverUrl: 'https://picsum.photos/seed/paradise/200/200',
    releaseDate: '2022-02-15', songCount: 12, totalStreams: 850_000,   registeredAt: '15/02/2022' },
  { id: '4', title: 'Liminal',           artistId: 'a3',
    coverUrl: 'https://picsum.photos/seed/liminal/200/200',
    releaseDate: '2023-06-01', songCount: 9,  totalStreams: 420_000,   registeredAt: '01/06/2023' },
];

@Component({
  selector:    'rm-gestion-albumes-page',
  standalone:  true,
  imports:     [LucideAngularModule, AdminSidebarComponent],
  templateUrl: './gestion-albumes.page.html',
  styleUrl:    './gestion-albumes.page.scss',
})
export class GestionAlbumesPage {

  /* ── Icons ─────────────────────────────────────────────────────────── */
  readonly Menu          = Menu;
  readonly Plus          = Plus;
  readonly Search        = Search;
  readonly Eye           = Eye;
  readonly Pencil        = Pencil;
  readonly Trash2        = Trash2;
  readonly X             = X;
  readonly ChevronDown   = ChevronDown;
  readonly Check         = Check;
  readonly TriangleAlert = TriangleAlert;
  readonly Disc3         = Disc3;
  readonly UserRound     = UserRound;

  /* ── Sidebar ────────────────────────────────────────────────────────── */
  readonly sidebarOpen = signal(false);

  /* ── Data ───────────────────────────────────────────────────────────── */
  private readonly _albums  = signal<Album[]>(structuredClone(MOCK_ALBUMS));
  readonly artists           = ALBUM_ARTISTS;

  /* ── Search ─────────────────────────────────────────────────────────── */
  readonly searchQuery = signal('');

  readonly filteredAlbums = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this._albums();
    return this._albums().filter(a => {
      const artist = this.getArtist(a.artistId);
      return a.title.toLowerCase().includes(q)
          || (artist?.name.toLowerCase().includes(q) ?? false);
    });
  });

  /* ── Modal: View ────────────────────────────────────────────────────── */
  readonly viewingAlbum = signal<Album | null>(null);
  openViewModal(a: Album): void  { this.viewingAlbum.set(a); }
  closeViewModal(): void         { this.viewingAlbum.set(null); }

  /* ── Modal: Create / Edit ───────────────────────────────────────────── */
  readonly modalMode     = signal<'create' | 'edit' | null>(null);
  readonly editingAlbum  = signal<Album | null>(null);

  readonly formTitle       = signal('');
  readonly formArtistId    = signal('');
  readonly formCoverUrl    = signal('');
  readonly formReleaseDate = signal(this.todayISO());
  readonly artistDropOpen  = signal(false);

  readonly formValid = computed(() =>
    this.formTitle().trim().length > 0
    && this.formArtistId().length > 0
    && this.formReleaseDate().length > 0,
  );

  readonly selectedArtist = computed(() =>
    this.artists.find(a => a.id === this.formArtistId()) ?? null,
  );

  openCreateModal(): void {
    this.formTitle.set('');
    this.formArtistId.set('');
    this.formCoverUrl.set('');
    this.formReleaseDate.set(this.todayISO());
    this.artistDropOpen.set(false);
    this.editingAlbum.set(null);
    this.modalMode.set('create');
  }

  openEditModal(a: Album): void {
    this.formTitle.set(a.title);
    this.formArtistId.set(a.artistId);
    this.formCoverUrl.set(a.coverUrl);
    this.formReleaseDate.set(a.releaseDate);
    this.artistDropOpen.set(false);
    this.editingAlbum.set(a);
    this.modalMode.set('edit');
  }

  closeModal(): void {
    this.modalMode.set(null);
    this.editingAlbum.set(null);
    this.artistDropOpen.set(false);
  }

  selectArtist(id: string): void {
    this.formArtistId.set(id);
    this.artistDropOpen.set(false);
  }

  submitModal(): void {
    if (!this.formValid()) return;
    const now = new Date();
    const reg = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;

    if (this.modalMode() === 'create') {
      const nuevo: Album = {
        id:           crypto.randomUUID(),
        title:        this.formTitle().trim(),
        artistId:     this.formArtistId(),
        coverUrl:     this.formCoverUrl().trim(),
        releaseDate:  this.formReleaseDate(),
        songCount:    0,
        totalStreams:  0,
        registeredAt: reg,
      };
      this._albums.update(list => [nuevo, ...list]);
    } else {
      const target = this.editingAlbum();
      if (!target) return;
      this._albums.update(list =>
        list.map(a => a.id === target.id
          ? { ...a, title: this.formTitle().trim(), artistId: this.formArtistId(),
              coverUrl: this.formCoverUrl().trim(), releaseDate: this.formReleaseDate() }
          : a),
      );
    }
    this.closeModal();
  }

  /* ── Modal: Delete confirm ──────────────────────────────────────────── */
  readonly deletingAlbum = signal<Album | null>(null);
  openDeleteModal(a: Album): void { this.deletingAlbum.set(a); }
  closeDeleteModal(): void        { this.deletingAlbum.set(null); }

  confirmDelete(): void {
    const a = this.deletingAlbum();
    if (!a) return;
    this._albums.update(list => list.filter(x => x.id !== a.id));
    this.closeDeleteModal();
  }

  /* ── Helpers ────────────────────────────────────────────────────────── */
  anyModalOpen(): boolean {
    return !!this.modalMode() || !!this.viewingAlbum() || !!this.deletingAlbum();
  }

  getArtist(id: string): ArtistRef | undefined {
    return this.artists.find(a => a.id === id);
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
  }

  formatStreams(n: number): string {
    return n.toLocaleString('es-ES');
  }

  todayISO(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  }

  onImgError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}
