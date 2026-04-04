import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule, House, Search, Library, Plus } from 'lucide-angular';
import { LibraryState } from '../../state/library.state';
import { PlaylistState } from '../../state/playlist.state';
import { UserProfileState } from '../../state/user-profile.state';
import { DrawerMenuComponent } from '../../components/drawer-menu/drawer-menu.component';

type LibraryTab = 'playlists' | 'artists';

@Component({
  selector: 'rm-library-page',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, DrawerMenuComponent],
  templateUrl: './library.page.html',
  styleUrl: './library.page.scss',
})
export class LibraryPage {
  readonly House   = House;
  readonly Search  = Search;
  readonly Library = Library;
  readonly Plus    = Plus;

  private readonly router = inject(Router);
  private readonly route  = inject(ActivatedRoute);
  readonly profileState   = inject(UserProfileState);
  readonly state          = inject(LibraryState);
  readonly playlistState  = inject(PlaylistState);

  readonly tab            = signal<LibraryTab>('playlists');
  readonly artists        = this.state.artists;
  readonly albums         = this.state.albums;
  readonly hasArtists     = computed(() => this.artists().length > 0);
  readonly hasAlbums      = computed(() => this.albums().length > 0);
  readonly createMenuOpen = signal(false);
  readonly hasPlaylist    = computed(() => this.playlistState.playlist() !== null);
  readonly drawerOpen     = signal(false);

  constructor() {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'artists') this.tab.set('artists');
  }

  setTab(tab: LibraryTab): void { this.tab.set(tab); }
  goAddArtists(): void { this.router.navigate(['/library/add-artists']); }
  goAddAlbums():  void { this.router.navigate(['/library/add-albums']); }
  openCreateMenu():  void { this.createMenuOpen.set(true); }
  closeCreateMenu(): void { this.createMenuOpen.set(false); }

  goCreatePlaylist(): void {
    this.createMenuOpen.set(false);
    this.router.navigate(['/library/playlist/new']);
  }

  openDrawer():  void { this.drawerOpen.set(true); }
  closeDrawer(): void { this.drawerOpen.set(false); }
}
