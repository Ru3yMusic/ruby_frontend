import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, ChevronLeft, House, Search, Library, Plus } from 'lucide-angular';
import { TrackItem, ARTIST_HEROES_TRACKS } from '../../state/tracks-mock.data';

interface ArtistTrack extends TrackItem { plays: string; }

const ARTIST_PLAYS: Record<number, string> = {
  8:  '323.392.188',
  9:  '300.443.222',
  10: '200.332.122',
  11: '198.232.321',
};

@Component({
  selector: 'rm-artist-page',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './artist.page.html',
  styleUrl: './artist.page.scss',
})
export class ArtistPage {
  constructor(private readonly router: Router) {}
  readonly ChevronLeft = ChevronLeft;
  readonly House       = House;
  readonly Search      = Search;
  readonly Library     = Library;
  readonly Plus        = Plus;

  readonly artistMenuOpen = signal(false);
  readonly songMenuFor    = signal<number | null>(null);

  readonly tracks: ArtistTrack[] = ARTIST_HEROES_TRACKS.map(t => ({
    ...t,
    plays: ARTIST_PLAYS[t.id] ?? '0',
  }));

  openArtistMenu(): void {
    this.songMenuFor.set(null);
    this.artistMenuOpen.set(true);
  }

  openSongMenu(id: number): void {
    this.artistMenuOpen.set(false);
    this.songMenuFor.set(id);
  }

  closeMenus(): void {
    this.artistMenuOpen.set(false);
    this.songMenuFor.set(null);
  }

  goAlbum(): void {
    this.closeMenus();
    this.router.navigate(['/music/album/rebel-yell']);
  }

  openPlayer(id: number): void {
    this.router.navigate(['/music/player', id]);
  }
}
