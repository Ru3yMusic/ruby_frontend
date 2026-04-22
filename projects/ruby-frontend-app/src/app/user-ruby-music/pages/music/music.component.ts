import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LibraryState } from '../../state/library.state';

type HomeTab = 'TODAS' | 'MUSICA' | 'ESTACION';

interface RankedAlbumCard {
  id: string;
  rank: number;
  title: string;
  artistName: string;
  coverUrl: string;
  totalMinutesLabel: string;
}

@Component({
  selector: 'app-music',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './music.component.html',
  styleUrls: ['./music.component.scss'],
})
export class MusicComponent {
  private readonly router = inject(Router);
  private readonly libraryState = inject(LibraryState);

  private readonly defaultAlbumCover = '/assets/icons/playlist-cover-placeholder.png';

  readonly loading = this.libraryState.loading;

  readonly topAlbumsByMinutes = computed<RankedAlbumCard[]>(() => {
    const albums = this.libraryState.albums();
    const songs = this.libraryState.songs();
    const artists = this.libraryState.artists();

    return albums
      .map(album => {
        const artist = artists.find(a => a.id === album.artist?.id);

        const totalSeconds = songs
          .filter(s => s.album?.id === album.id)
          .reduce((total, s) => total + (s.duration ?? 0), 0);

        return {
          id: album.id ?? '',
          title: album.title ?? '',
          artistName: artist?.name ?? 'Artista desconocido',
          coverUrl: album.coverUrl || this.defaultAlbumCover,
          totalSeconds,
        };
      })
      .sort((a, b) => b.totalSeconds - a.totalSeconds)
      .slice(0, 3)
      .map((album, index) => ({
        id: album.id,
        rank: index + 1,
        title: album.title,
        artistName: album.artistName,
        coverUrl: album.coverUrl,
        totalMinutesLabel: this.formatMinutesLabel(album.totalSeconds),
      }));
  });

  constructor() {
    this.libraryState.loadNewReleases();
    // loadRecentSongs populates the global `songs` signal that
    // topAlbumsByMinutes aggregates for the "Tus álbumes más largos" ranking
    // — the name is historic; it's the general catalog loader here.
    this.libraryState.loadRecentSongs();
    this.libraryState.loadArtists();
  }

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

  goToAlbum(albumId: string): void {
    if (!albumId) return;
    this.router.navigate(['/user/album', albumId]);
  }

  private formatMinutesLabel(totalSeconds: number): string {
    const totalMinutes = Math.max(1, Math.floor(totalSeconds / 60));
    return `${totalMinutes} minutos`;
  }
}
