import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';

type HeaderSearchResultType = 'SONG' | 'ALBUM' | 'ARTIST';

interface ArtistItem {
  id: string;
  name: string;
  photoUrl?: string | null;
}

interface AlbumItem {
  id: string;
  title: string;
  artistId: string;
  coverUrl?: string | null;
}

interface SongItem {
  id: string;
  title: string;
  artistId: string;
  albumId: string | null;
  coverUrl?: string | null;
}

interface HeaderSearchResult {
  id: string;
  type: HeaderSearchResultType;
  title: string;
  imageUrl: string | null;
}

@Component({
  selector: 'app-top-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './top-header.component.html',
  styleUrls: ['./top-header.component.scss'],
})
export class TopHeaderComponent {
  private readonly authState = inject(AuthState);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);

  private readonly ARTISTS_KEY = 'ruby_artists';
  private readonly ALBUMS_KEY = 'ruby_albums';
  private readonly SONGS_KEY = 'ruby_songs';

  readonly currentUser = this.authState.currentUser;

  isProfileMenuOpen = false;
  isSearchOpen = false;
  searchQuery = '';

  goToHome(): void {
    this.closeAllOverlays();
    this.router.navigate(['/user/home']);
  }

  goToLibrary(): void {
    this.closeAllOverlays();
    this.router.navigate(['/user/library']);
  }

  openSearch(event: MouseEvent): void {
    event.stopPropagation();
    this.isProfileMenuOpen = false;
    this.isSearchOpen = true;
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery = input.value;
    this.isSearchOpen = true;
    this.isProfileMenuOpen = false;
  }

  clearSearch(event?: MouseEvent): void {
    event?.stopPropagation();
    this.searchQuery = '';
    this.isSearchOpen = false;
  }

  toggleProfileMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isSearchOpen = false;
    this.isProfileMenuOpen = !this.isProfileMenuOpen;
  }

  goToProfile(): void {
    this.closeAllOverlays();
    this.router.navigate(['/user/profile']);
  }

  logout(): void {
    this.closeAllOverlays();
    this.authState.clearCurrentUser();
    this.router.navigate(['/auth/welcome']);
  }

  get hasSearchTerm(): boolean {
    return this.normalizedSearchTerm.length > 0;
  }

  get searchResults(): HeaderSearchResult[] {
    const term = this.normalizedSearchTerm;
    if (!term) return [];

    const songs = this.loadStorage<SongItem>(this.SONGS_KEY);
    const albums = this.loadStorage<AlbumItem>(this.ALBUMS_KEY);
    const artists = this.loadStorage<ArtistItem>(this.ARTISTS_KEY);

    const songResults: HeaderSearchResult[] = songs
      .filter(song => (song.title ?? '').toLowerCase().includes(term))
      .slice(0, 4)
      .map(song => ({
        id: song.id,
        type: 'SONG',
        title: song.title?.trim() || 'Canción sin nombre',
        imageUrl: song.coverUrl ?? null,
      }));

    const albumResults: HeaderSearchResult[] = albums
      .filter(album => (album.title ?? '').toLowerCase().includes(term))
      .slice(0, 4)
      .map(album => ({
        id: album.id,
        type: 'ALBUM',
        title: album.title?.trim() || 'Álbum sin nombre',
        imageUrl: album.coverUrl ?? null,
      }));

    const artistResults: HeaderSearchResult[] = artists
      .filter(artist => (artist.name ?? '').toLowerCase().includes(term))
      .slice(0, 4)
      .map(artist => ({
        id: artist.id,
        type: 'ARTIST',
        title: artist.name?.trim() || 'Artista desconocido',
        imageUrl: artist.photoUrl ?? null,
      }));

    return [...songResults, ...albumResults, ...artistResults].slice(0, 10);
  }

  get hasSearchResults(): boolean {
    return this.searchResults.length > 0;
  }

  isSongResult(result: HeaderSearchResult): boolean {
    return result.type === 'SONG';
  }

  isAlbumResult(result: HeaderSearchResult): boolean {
    return result.type === 'ALBUM';
  }

  isArtistResult(result: HeaderSearchResult): boolean {
    return result.type === 'ARTIST';
  }

  goToSearchResult(result: HeaderSearchResult): void {
    if (result.type === 'ALBUM') {
      this.closeAllOverlays();
      this.router.navigate(['/user/album', result.id]);
      return;
    }

    if (result.type === 'ARTIST') {
      this.closeAllOverlays();
      this.router.navigate(['/user/artist', result.id]);
      return;
    }

    if (result.type === 'SONG') {
      // Ruta futura preparada cuando exista /user/song/:id
      // this.closeAllOverlays();
      // this.router.navigate(['/user/song', result.id]);
      return;
    }
  }

  trackBySearchResult(_: number, result: HeaderSearchResult): string {
    return `${result.type}-${result.id}`;
  }

  private get normalizedSearchTerm(): string {
    return this.searchQuery.trim().toLowerCase();
  }

  private loadStorage<T>(key: string): T[] {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T[]) : [];
    } catch {
      return [];
    }
  }

  private closeAllOverlays(): void {
    this.isProfileMenuOpen = false;
    this.isSearchOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target) return;

    if (!this.elementRef.nativeElement.contains(target)) {
      this.closeAllOverlays();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeAllOverlays();
  }
}