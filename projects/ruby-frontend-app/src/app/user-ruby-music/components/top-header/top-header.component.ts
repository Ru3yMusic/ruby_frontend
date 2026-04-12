import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { PlaylistState } from '../../state/playlist.state';

type HeaderSearchResultType = 'SONG' | 'ALBUM' | 'ARTIST';

interface ArtistItem {
  id: string;
  name: string;
  photoUrl?: string | null;
  monthlyListeners?: string;
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

interface LibraryItem {
  id: string;
  userId: string;
  itemType: 'ARTIST' | 'ALBUM';
  itemId: string;
  addedAt: string;
}

interface HeaderSearchResult {
  id: string;
  type: HeaderSearchResultType;
  title: string;
  imageUrl: string | null;
  subtitle: string;
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
  private readonly playlistState = inject(PlaylistState);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);

  private readonly ARTISTS_KEY = 'ruby_artists';
  private readonly ALBUMS_KEY = 'ruby_albums';
  private readonly SONGS_KEY = 'ruby_songs';
  private readonly USER_LIBRARY_KEY = 'ruby_user_library';

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
      .map(song => {
        const artist = artists.find(item => item.id === song.artistId);

        return {
          id: song.id,
          type: 'SONG',
          title: song.title?.trim() || 'Canción sin nombre',
          imageUrl: song.coverUrl ?? null,
          subtitle: `Canción · ${artist?.name ?? 'Artista desconocido'}`,
        };
      });

    const albumResults: HeaderSearchResult[] = albums
      .filter(album => (album.title ?? '').toLowerCase().includes(term))
      .slice(0, 4)
      .map(album => {
        const artist = artists.find(item => item.id === album.artistId);

        return {
          id: album.id,
          type: 'ALBUM',
          title: album.title?.trim() || 'Álbum sin nombre',
          imageUrl: album.coverUrl ?? null,
          subtitle: `Álbum · ${artist?.name ?? 'Artista desconocido'}`,
        };
      });

    const artistResults: HeaderSearchResult[] = artists
      .filter(artist => (artist.name ?? '').toLowerCase().includes(term))
      .slice(0, 4)
      .map(artist => ({
        id: artist.id,
        type: 'ARTIST',
        title: artist.name?.trim() || 'Artista desconocido',
        imageUrl: artist.photoUrl ?? null,
        subtitle: 'Artista',
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
      this.closeAllOverlays();
      this.router.navigate(['/user/song', result.id]);
    }
  }

  isSongLiked(songId: string): boolean {
    const user = this.currentUser();
    if (!user?.id) return false;

    const likedPlaylist = this.playlistState.getLikedSongsPlaylist(user.id)
      ?? this.playlistState.ensureLikedSongsPlaylist(user.id);

    return likedPlaylist.songIds.includes(songId);
  }

  toggleSongLike(result: HeaderSearchResult, event: MouseEvent): void {
    event.stopPropagation();

    const user = this.currentUser();
    if (!user?.id || result.type !== 'SONG') return;

    if (this.isSongLiked(result.id)) {
      this.playlistState.removeSongFromLikedSongs(user.id, result.id);
      return;
    }

    this.playlistState.addSongToLikedSongs(user.id, result.id);
  }

  isAlbumSaved(albumId: string): boolean {
    const user = this.currentUser();
    if (!user?.id) return false;

    return this.loadUserLibrary().some(
      item =>
        item.userId === user.id &&
        item.itemType === 'ALBUM' &&
        item.itemId === albumId
    );
  }

  toggleSaveAlbum(result: HeaderSearchResult, event: MouseEvent): void {
    event.stopPropagation();

    const user = this.currentUser();
    if (!user?.id || result.type !== 'ALBUM') return;

    const currentLibrary = this.loadUserLibrary();

    if (this.isAlbumSaved(result.id)) {
      const updated = currentLibrary.filter(
        item =>
          !(
            item.userId === user.id &&
            item.itemType === 'ALBUM' &&
            item.itemId === result.id
          )
      );

      this.persistUserLibrary(updated);
      return;
    }

    const newItem: LibraryItem = {
      id: this.generateId(),
      userId: user.id,
      itemType: 'ALBUM',
      itemId: result.id,
      addedAt: new Date().toISOString(),
    };

    this.persistUserLibrary([...currentLibrary, newItem]);
  }

  isArtistFollowed(artistId: string): boolean {
    const user = this.currentUser();
    if (!user?.id) return false;

    return this.loadUserLibrary().some(
      item =>
        item.userId === user.id &&
        item.itemType === 'ARTIST' &&
        item.itemId === artistId
    );
  }

  toggleFollowArtist(result: HeaderSearchResult, event: MouseEvent): void {
    event.stopPropagation();

    const user = this.currentUser();
    if (!user?.id || result.type !== 'ARTIST') return;

    const currentLibrary = this.loadUserLibrary();

    if (this.isArtistFollowed(result.id)) {
      const updated = currentLibrary.filter(
        item =>
          !(
            item.userId === user.id &&
            item.itemType === 'ARTIST' &&
            item.itemId === result.id
          )
      );

      this.persistUserLibrary(updated);
      return;
    }

    const newItem: LibraryItem = {
      id: this.generateId(),
      userId: user.id,
      itemType: 'ARTIST',
      itemId: result.id,
      addedAt: new Date().toISOString(),
    };

    this.persistUserLibrary([...currentLibrary, newItem]);
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

  private loadUserLibrary(): LibraryItem[] {
    return this.loadStorage<LibraryItem>(this.USER_LIBRARY_KEY);
  }

  private persistUserLibrary(items: LibraryItem[]): void {
    localStorage.setItem(this.USER_LIBRARY_KEY, JSON.stringify(items));
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return `library-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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