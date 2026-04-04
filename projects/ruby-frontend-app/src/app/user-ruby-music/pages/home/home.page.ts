import { Component, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { UserProfileState } from '../../state/user-profile.state';
import { TrackItem, HOME_TRACKS } from '../../state/tracks-mock.data';
import {
  LucideAngularModule,
  Heart, Play, House, Search, Library, Plus, EllipsisVertical,
} from 'lucide-angular';
import { DrawerMenuComponent } from '../../components/drawer-menu/drawer-menu.component';

type HomeFilter = 'Todas' | 'Musica' | 'Estacion';

interface ArtistItem  { name: string; color: string; }
interface StationItem { name: string; gradient: string; }
interface AlbumItem   { title: string; gradient: string; }

@Component({
  selector: 'rm-home-page',
  standalone: true,
  imports: [NgClass, RouterLink, LucideAngularModule, DrawerMenuComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly router = inject(Router);
  readonly profileState     = inject(UserProfileState);
  readonly Heart            = Heart;
  readonly Play             = Play;
  readonly House            = House;
  readonly Search           = Search;
  readonly Library          = Library;
  readonly Plus             = Plus;
  readonly EllipsisVertical = EllipsisVertical;

  readonly filters: HomeFilter[] = ['Todas', 'Musica', 'Estacion'];
  readonly activeFilter          = signal<HomeFilter>('Todas');
  readonly selectedTrack         = signal<TrackItem | null>(null);
  readonly playlistModalOpen     = signal(false);
  readonly selectedSavedPlaylist = signal<'mood freeze' | null>(null);
  readonly likedInLibrary        = signal(false);
  readonly likedToast            = signal(false);
  readonly drawerOpen            = signal(false);

  readonly tracks   = HOME_TRACKS;

  readonly artists: ArtistItem[] = [
    { name: 'Wisin',        color: '#198f86' },
    { name: 'GreenDay',     color: '#a79246' },
    { name: 'Frankie Ruiz', color: '#18398e' },
  ];

  readonly stations: StationItem[] = [
    { name: 'Rock',              gradient: 'linear-gradient(160deg, #7f2e8f 0%, #63256f 100%)' },
    { name: 'Salsa',             gradient: 'linear-gradient(160deg, #3f97a0 0%, #317d85 100%)' },
    { name: 'Merengue',          gradient: 'linear-gradient(160deg, #8c5a26 0%, #79491b 100%)' },
    { name: 'Flameto Estation',  gradient: 'linear-gradient(180deg, #101722 10%, #53666d 100%)' },
    { name: 'Bachata Estacion',  gradient: 'linear-gradient(180deg, #2a8cb6 10%, #28708f 100%)' },
    { name: 'Salsa estacion',    gradient: 'linear-gradient(180deg, #6f6515 10%, #9f9327 100%)' },
    { name: 'Reaggeton Estacion',gradient: 'linear-gradient(180deg, #13258e 10%, #2238c0 100%)' },
    { name: 'Rock Estacion',     gradient: 'linear-gradient(180deg, #10652b 10%, #0a4320 100%)' },
    { name: 'Vallenato Estacion',gradient: 'linear-gradient(180deg, #ad1894 10%, #d632bf 100%)' },
    { name: 'Cumbia Estacion',   gradient: 'linear-gradient(180deg, #be6c21 10%, #9c4f14 100%)' },
    { name: 'Merengue Estacion', gradient: 'linear-gradient(180deg, #6e7f1f 10%, #b4cc32 100%)' },
  ];

  readonly albums: AlbumItem[] = [
    { title: 'No.5',    gradient: 'linear-gradient(165deg, #6f2f88 0%, #5a226e 100%)' },
    { title: 'Legacy',  gradient: 'linear-gradient(165deg, #2f8c95 0%, #2a6f77 100%)' },
    { title: 'Clasicos',gradient: 'linear-gradient(165deg, #936027 0%, #7a4819 100%)' },
  ];

  setFilter(f: HomeFilter): void { this.activeFilter.set(f); }
  showStationsOnly(): boolean { return this.activeFilter() === 'Estacion'; }
  showMusicSections(): boolean { return this.activeFilter() === 'Todas' || this.activeFilter() === 'Musica'; }
  showAllSections(): boolean { return this.activeFilter() === 'Todas'; }

  openTrackMenu(track: TrackItem): void { this.selectedTrack.set(track); }

  closeTrackMenu(): void {
    this.selectedTrack.set(null);
    this.playlistModalOpen.set(false);
  }

  addTrackToLiked(): void {
    this.closeTrackMenu();
    this.likedToast.set(true);
    setTimeout(() => this.likedToast.set(false), 2000);
  }

  openPlaylistPicker(): void  { this.playlistModalOpen.set(true); }
  togglePlaylistSelection(): void { this.selectedSavedPlaylist.update(v => (v ? null : 'mood freeze')); }
  saveInLibrary(): void       { this.likedInLibrary.set(true); }
  newPlaylist(): void         { this.closeTrackMenu(); this.router.navigate(['/library/playlist/new']); }

  goAlbumFromTrack(): void  { this.closeTrackMenu(); this.router.navigate(['/music/album/rebel-yell']); }
  goArtistFromTrack(): void { this.closeTrackMenu(); this.router.navigate(['/music/artist/heroes-del-silencio']); }

  openDrawer():  void { this.drawerOpen.set(true); }
  closeDrawer(): void { this.drawerOpen.set(false); }
}
