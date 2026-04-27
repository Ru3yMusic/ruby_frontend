import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthRepositoryPort } from 'lib-ruby-core';
import { EMPTY } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { SongResponse, ArtistResponse, AlbumResponse } from 'lib-ruby-sdks/catalog-service';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { TokenStorageService } from '../../../core/services/token-storage.service';
import { LibraryState } from '../../state/library.state';
import { InteractionState } from '../../state/interaction.state';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';

type HeaderSearchResultType = 'SONG' | 'ALBUM' | 'ARTIST';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ImgFallbackDirective],
  templateUrl: './top-header.component.html',
  styleUrls: ['./top-header.component.scss'],
})
export class TopHeaderComponent {
  private readonly authState = inject(AuthState);
  private readonly libraryState = inject(LibraryState);
  private readonly interactionState = inject(InteractionState);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly authRepo = inject(AuthRepositoryPort);

  readonly currentUser = this.authState.currentUser;

  isProfileMenuOpen = false;
  isSearchOpen = false;
  searchQuery = '';

  goToHome(): void {
    this.closeAllOverlays();
    if (this.router.url === '/user/home') return;
    this.router.navigate(['/user/home']);
  }

  goToLibrary(): void {
    this.closeAllOverlays();
    if (this.router.url === '/user/library') return;
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

    const refreshToken = this.tokenStorage.getRefreshToken();

    const finalizeLogout = () => {
      this.tokenStorage.clearTokens();
      this.authState.clearSession();
      this.router.navigateByUrl('/auth/welcome');
    };

    const request$ = refreshToken
      ? this.authRepo.logout(refreshToken)
      : EMPTY;

    request$.pipe(finalize(finalizeLogout)).subscribe({
      error: () => {
        // Backend puede fallar (token expirado / red) — finalize limpia sesión igual.
      },
    });
  }

  get hasSearchTerm(): boolean {
    return this.normalizedSearchTerm.length > 0;
  }

  get searchResults(): HeaderSearchResult[] {
    const term = this.normalizedSearchTerm;
    if (!term) return [];

    const songs = this.libraryState.songs();
    const albums = this.libraryState.albums();
    const artists = this.libraryState.artists();

    const songResults: HeaderSearchResult[] = songs
      .filter((s: SongResponse) => (s.title ?? '').toLowerCase().includes(term))
      .slice(0, 4)
      .map((s: SongResponse) => {
        const artist = artists.find((a: ArtistResponse) => a.id === s.artist?.id);
        return {
          id: s.id ?? '',
          type: 'SONG' as HeaderSearchResultType,
          title: s.title?.trim() || 'Canción sin nombre',
          imageUrl: s.coverUrl ?? null,
          subtitle: `Canción · ${artist?.name ?? 'Artista desconocido'}`,
        };
      });

    const albumResults: HeaderSearchResult[] = albums
      .filter((a: AlbumResponse) => (a.title ?? '').toLowerCase().includes(term))
      .slice(0, 4)
      .map((a: AlbumResponse) => {
        const artist = artists.find((ar: ArtistResponse) => ar.id === a.artist?.id);
        return {
          id: a.id ?? '',
          type: 'ALBUM' as HeaderSearchResultType,
          title: a.title?.trim() || 'Álbum sin nombre',
          imageUrl: a.coverUrl ?? null,
          subtitle: `Álbum · ${artist?.name ?? 'Artista desconocido'}`,
        };
      });

    const artistResults: HeaderSearchResult[] = artists
      .filter((a: ArtistResponse) => (a.name ?? '').toLowerCase().includes(term))
      .slice(0, 4)
      .map((a: ArtistResponse) => ({
        id: a.id ?? '',
        type: 'ARTIST' as HeaderSearchResultType,
        title: a.name?.trim() || 'Artista desconocido',
        imageUrl: a.photoUrl ?? null,
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
    this.closeAllOverlays();
    if (result.type === 'ALBUM') { this.router.navigate(['/user/album', result.id]); return; }
    if (result.type === 'ARTIST') { this.router.navigate(['/user/artist', result.id]); return; }
    if (result.type === 'SONG') { this.router.navigate(['/user/song', result.id]); }
  }

  isSongLiked(songId: string): boolean {
    return this.interactionState.isSongLiked(songId);
  }

  toggleSongLike(result: HeaderSearchResult, event: MouseEvent): void {
    event.stopPropagation();
    if (result.type !== 'SONG') return;
    this.interactionState.toggleLike(result.id);
  }

  isAlbumSaved(albumId: string): boolean {
    return this.interactionState.isAlbumInLibrary(albumId);
  }

  toggleSaveAlbum(result: HeaderSearchResult, event: MouseEvent): void {
    event.stopPropagation();
    if (result.type !== 'ALBUM') return;

    if (this.interactionState.isAlbumInLibrary(result.id)) {
      this.interactionState.removeAlbumFromLibrary(result.id);
    } else {
      this.interactionState.addAlbumToLibrary(result.id);
    }
  }

  isArtistFollowed(artistId: string): boolean {
    return this.interactionState.isArtistInLibrary(artistId);
  }

  toggleFollowArtist(result: HeaderSearchResult, event: MouseEvent): void {
    event.stopPropagation();
    if (result.type !== 'ARTIST') return;

    if (this.interactionState.isArtistInLibrary(result.id)) {
      this.interactionState.removeArtistFromLibrary(result.id);
    } else {
      this.interactionState.addArtistToLibrary(result.id);
    }
  }

  trackBySearchResult(_: number, result: HeaderSearchResult): string {
    return `${result.type}-${result.id}`;
  }

  private get normalizedSearchTerm(): string {
    return this.searchQuery.trim().toLowerCase();
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
