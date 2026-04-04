import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, ChevronLeft, House, Search, Library, Plus } from 'lucide-angular';
import { TrackItem, ALBUM_REBEL_YELL_TRACKS } from '../../state/tracks-mock.data';

interface AlbumTrack extends TrackItem { hidden: boolean; }

@Component({
  selector: 'rm-album-page',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './album.page.html',
  styleUrl: './album.page.scss',
})
export class AlbumPage {
  constructor(private readonly router: Router) {}
  readonly ChevronLeft = ChevronLeft;
  readonly House       = House;
  readonly Search      = Search;
  readonly Library     = Library;
  readonly Plus        = Plus;

  readonly albumMenuOpen = signal(false);
  readonly songMenuFor   = signal<number | null>(null);
  readonly toast         = signal<string>('');

  readonly tracks = signal<AlbumTrack[]>(
    ALBUM_REBEL_YELL_TRACKS.map(t => ({ ...t, hidden: false }))
  );

  openAlbumMenu(): void {
    this.songMenuFor.set(null);
    this.albumMenuOpen.set(true);
  }

  openSongMenu(id: number): void {
    this.albumMenuOpen.set(false);
    this.songMenuFor.set(id);
  }

  closeMenus(): void {
    this.albumMenuOpen.set(false);
    this.songMenuFor.set(null);
  }

  goArtist(): void {
    this.closeMenus();
    this.router.navigate(['/music/artist/heroes-del-silencio']);
  }

  hideInAlbum(id: number): void {
    this.tracks.update(items => items.map(t => (t.id === id ? { ...t, hidden: true } : t)));
    this.closeMenus();
    this.showToast('Oculta en Rebel Yell');
  }

  undoHide(): void {
    this.tracks.update(items => items.map(t => ({ ...t, hidden: false })));
    this.toast.set('');
  }

  openPlayer(id: number): void {
    this.router.navigate(['/music/player', id]);
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 2600);
  }
}
