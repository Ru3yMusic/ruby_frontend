import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PlaylistResponse } from 'lib-ruby-sdks/playlist-service';
import { MusicFeedState } from '../../state/music-feed.state';
import { SavedPlaylistsState } from '../../state/saved-playlists.state';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';

type HomeTab = 'TODAS' | 'MUSICA' | 'ESTACION';

@Component({
  selector: 'app-music',
  standalone: true,
  imports: [CommonModule, ImgFallbackDirective],
  providers: [MusicFeedState],
  templateUrl: './music.component.html',
  styleUrls: ['./music.component.scss'],
})
export class MusicComponent {
  private readonly router = inject(Router);
  protected readonly feed = inject(MusicFeedState);
  protected readonly savedPlaylistsState = inject(SavedPlaylistsState);

  readonly defaultAlbumCover = '/assets/icons/playlist-cover-placeholder.png';
  readonly defaultArtistPhoto = '/assets/icons/avatar-placeholder.png';
  readonly defaultPlaylistCover = '/assets/icons/playlist-cover-placeholder.png';

  setActiveTab(tab: HomeTab): void {
    if (tab === 'TODAS') {
      this.router.navigate(['/user/home']);
      return;
    }

    if (tab === 'MUSICA') {
      this.router.navigate(['/user/music']);
      return;
    }

    if (tab === 'ESTACION') {
      this.router.navigate(['/user/station']);
    }
  }

  isTabActive(tab: HomeTab): boolean {
    const currentUrl = this.router.url;

    if (tab === 'TODAS') return currentUrl === '/user/home';
    if (tab === 'MUSICA') return currentUrl === '/user/music';
    if (tab === 'ESTACION') return currentUrl === '/user/station';

    return false;
  }

  goToAlbum(albumId: string | undefined): void {
    if (!albumId) return;
    this.router.navigate(['/user/album', albumId]);
  }

  goToArtist(artistId: string | undefined): void {
    if (!artistId) return;
    this.router.navigate(['/user/artist', artistId]);
  }

  goToPlaylist(playlistId: string | undefined): void {
    if (!playlistId) return;
    this.router.navigate(['/user/playlist', playlistId]);
  }

  /**
   * Toggle del estado "guardada en biblioteca" para una playlist pública ajena.
   * stopPropagation evita que el click navegue a la playlist (la card sigue
   * siendo clickeable para abrir, pero el botón de save se aísla).
   *
   * IMPORTANTE — la card NO desaparece de /user/music al guardarla. Solo cambia
   * el estado visual del botón. Es page-scoped, sigue mostrando lo que el feed
   * recomienda al usuario actual.
   */
  togglePlaylistSave(event: MouseEvent, playlist: PlaylistResponse): void {
    event.stopPropagation();
    const id = playlist.id;
    if (!id) return;
    if (this.savedPlaylistsState.isPlaylistSaved(id)) {
      this.savedPlaylistsState.unsavePlaylist(id);
    } else {
      this.savedPlaylistsState.savePlaylist(playlist);
    }
  }

  isPlaylistSaved(playlistId: string | undefined): boolean {
    return this.savedPlaylistsState.isPlaylistSaved(playlistId);
  }
}
