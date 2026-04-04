import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Heart, CirclePlay, House, Search, Library, Plus } from 'lucide-angular';
import { UserProfileState } from '../../state/user-profile.state';
import { TrackItem, HOME_TRACKS } from '../../state/tracks-mock.data';
import { DrawerMenuComponent } from '../../components/drawer-menu/drawer-menu.component';

interface StationItem { name: string; color: string; }

@Component({
  selector: 'rm-music-search-page',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule, DrawerMenuComponent],
  templateUrl: './music-search.page.html',
  styleUrl: './music-search.page.scss',
})
export class MusicSearchPage {
  private readonly router = inject(Router);
  readonly profileState   = inject(UserProfileState);

  readonly Heart      = Heart;
  readonly CirclePlay = CirclePlay;
  readonly House      = House;
  readonly Search     = Search;
  readonly Library    = Library;
  readonly Plus       = Plus;

  readonly query                 = signal('');
  readonly selectedTrack         = signal<TrackItem | null>(null);
  readonly playlistModalOpen     = signal(false);
  readonly likedToast            = signal(false);
  readonly selectedSavedPlaylist = signal<'mood freeze' | null>(null);
  readonly likedInLibrary        = signal(false);
  readonly drawerOpen            = signal(false);

  readonly baseTracks = HOME_TRACKS;

  readonly searchTracks: TrackItem[] = Array.from({ length: 8 }, (_, i) => ({
    id: 20 + i,
    title: 'Corazon de seda',
    artist: 'Ozuna',
    color: i % 3 === 0 ? '#1a7b61' : i % 3 === 1 ? '#153f6e' : '#977523',
  }));

  readonly stations: StationItem[] = [
    { name: 'Rock',     color: '#7e2d8f' },
    { name: 'Salsa',    color: '#419aa2' },
    { name: 'Merengue', color: '#8a581f' },
    { name: 'Pop',      color: '#8a581f' },
    { name: 'Trap',     color: '#7e2d8f' },
    { name: 'Baladas',  color: '#419aa2' },
  ];

  readonly showSearchResults = computed(() => this.query().trim().length > 0);
  readonly visibleTracks     = computed(() => (this.showSearchResults() ? this.searchTracks : this.baseTracks));

  openTrackMenu(track: TrackItem): void { this.selectedTrack.set(track); }

  closeTrackMenu(): void {
    this.selectedTrack.set(null);
    this.playlistModalOpen.set(false);
  }

  addToLiked(): void { this.closeTrackMenu(); this.likedInLibrary.set(true); this.showLikedToast(); }
  openPlaylistPicker(): void { this.playlistModalOpen.set(true); }
  togglePlaylistSelection(): void { this.selectedSavedPlaylist.update(v => (v ? null : 'mood freeze')); }
  saveInLibrary(): void { this.likedInLibrary.set(true); }
  newPlaylist(): void { this.closeTrackMenu(); this.router.navigate(['/library/playlist/new']); }
  goAlbum():  void { this.closeTrackMenu(); this.router.navigate(['/music/album/rebel-yell']); }
  goArtist(): void { this.closeTrackMenu(); this.router.navigate(['/music/artist/heroes-del-silencio']); }

  openDrawer():  void { this.drawerOpen.set(true); }
  closeDrawer(): void { this.drawerOpen.set(false); }

  private showLikedToast(): void {
    this.likedToast.set(true);
    setTimeout(() => this.likedToast.set(false), 2200);
  }
}
