import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  ChevronLeft, ChevronRight, Heart, MessageCircle,
  EllipsisVertical, Send, House, Search, Library, Plus,
  SlidersHorizontal, X, Smile, Users,
} from 'lucide-angular';
import { DrawerMenuComponent } from '../../components/drawer-menu/drawer-menu.component';

interface CommentItem { id: number; user: string; text: string; time: string; likes: number; liked: boolean; }
interface LiveMessage  { id: number; user: string; text: string; }

const STATIONS = ['Rock', 'Pop', 'Salsa', 'Merengue', 'Bachata', 'Trap', 'Vallenato'];

@Component({
  selector: 'rm-station-page',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, DrawerMenuComponent],
  templateUrl: './station.page.html',
  styleUrl: './station.page.scss',
})
export class StationPage {
  readonly ChevronLeft       = ChevronLeft;
  readonly ChevronRight      = ChevronRight;
  readonly Heart             = Heart;
  readonly MessageCircle     = MessageCircle;
  readonly EllipsisVertical  = EllipsisVertical;
  readonly Send              = Send;
  readonly House             = House;
  readonly Search            = Search;
  readonly Library           = Library;
  readonly Plus              = Plus;
  readonly SlidersHorizontal = SlidersHorizontal;
  readonly X                 = X;
  readonly Smile             = Smile;
  readonly Users             = Users;

  private readonly router = inject(Router);
  private readonly route  = inject(ActivatedRoute);

  readonly stationIndex   = signal(0);
  readonly stationName    = computed(() => STATIONS[this.stationIndex()]);
  readonly liked          = signal(false);
  readonly commentsOpen   = signal(false);
  readonly sortMenuOpen   = signal(false);
  readonly commentMenuFor = signal<number | null>(null);
  readonly selectedSort   = signal<'Populares' | 'Los mas recientes'>('Populares');
  readonly drawerOpen     = signal(false);
  readonly chatInput      = signal('');
  private fromChat        = false;
  private nextMsgId       = 5;

  readonly liveMessages = signal<LiveMessage[]>([
    { id: 1, user: '@Carlos',   text: 'Esta cancion es un clasico 🔥' },
    { id: 2, user: '@Maria',    text: 'Me encanta esta estacion!' },
    { id: 3, user: '@Pedro',    text: 'Subele el volumen!!' },
    { id: 4, user: 'Tú',        text: 'Que buena, no la conocia' },
  ]);

  readonly comments = signal<CommentItem[]>([
    { id: 1, user: '@Arnold', text: 'That song make me feel so good!', time: 'hace 5h', likes: 22, liked: true },
    { id: 2, user: '@Maria',  text: 'Increible esta cancion 🔥',        time: 'hace 4h', likes: 8,  liked: false },
    { id: 3, user: '@Pedro',  text: 'La mejor estacion de todas',       time: 'hace 3h', likes: 5,  liked: true },
    { id: 4, user: '@Arnold', text: 'Alguien mas la tiene en repeat?',  time: 'hace 2h', likes: 13, liked: true },
    { id: 5, user: '@Laura',  text: 'No puedo dejar de escucharla',     time: 'hace 1h', likes: 0,  liked: false },
  ]);

  readonly commentsCount = computed(() => this.comments().length + 680);

  constructor() {
    const slug   = this.route.snapshot.paramMap.get('slug');
    const friend = this.route.snapshot.queryParamMap.get('friend');
    if (slug) {
      const name  = decodeURIComponent(slug).replace(/-/g, ' ');
      const index = STATIONS.findIndex(s => s.toLowerCase() === name.toLowerCase());
      if (index >= 0) this.stationIndex.set(index);
    }
    if (friend) this.fromChat = true;
  }

  prevStation(): void { this.stationIndex.update(i => (i > 0 ? i - 1 : STATIONS.length - 1)); }
  nextStation(): void { this.stationIndex.update(i => (i < STATIONS.length - 1 ? i + 1 : 0)); }

  toggleLikeSong(): void { this.liked.update(v => !v); }

  openComments(): void  { this.commentsOpen.set(true);  this.sortMenuOpen.set(false); this.commentMenuFor.set(null); }
  closeComments(): void { this.commentsOpen.set(false); this.sortMenuOpen.set(false); this.commentMenuFor.set(null); }

  toggleSortMenu(): void { this.commentMenuFor.set(null); this.sortMenuOpen.update(v => !v); }

  setSort(value: 'Populares' | 'Los mas recientes'): void {
    this.selectedSort.set(value);
    this.sortMenuOpen.set(false);
  }

  toggleCommentMenu(commentId: number): void {
    this.sortMenuOpen.set(false);
    this.commentMenuFor.update(c => (c === commentId ? null : commentId));
  }

  sendMessage(): void {
    const text = this.chatInput().trim();
    if (!text) return;
    this.liveMessages.update(msgs => [...msgs, { id: this.nextMsgId++, user: 'Tú', text }]);
    this.chatInput.set('');
  }

  goBack(): void { this.router.navigate([this.fromChat ? '/chat-estacion' : '/home']); }
  openDrawer():  void { this.drawerOpen.set(true); }
  closeDrawer(): void { this.drawerOpen.set(false); }
}
