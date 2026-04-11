import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

type HomeTab = 'TODAS' | 'MUSICA' | 'ESTACION';

interface StoredArtist {
  id: string;
  name: string;
  photoUrl: string;
  bio: string;
  isTop: boolean;
  followersCount: string;
  monthlyListeners: string;
  createdAt: string;
}

interface StoredAlbum {
  id: string;
  title: string;
  artistId: string;
  coverUrl: string;
  releaseDate: string;
  songsCount: number;
  totalStreams: string;
  createdAt: string;
}

interface StoredSong {
  id: string;
  title: string;
  artistId: string;
  albumId: string | null;
  genreId: string;
  coverUrl: string;
  audioUrl: string;
  durationSeconds: number;
  lyrics: string | null;
  playCount: number;
  likesCount: number;
  createdAt: string;
}

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

  private readonly ALBUMS_KEY = 'ruby_albums';
  private readonly SONGS_KEY = 'ruby_songs';
  private readonly ARTISTS_KEY = 'ruby_artists';
  private readonly defaultAlbumCover = '/assets/icons/playlist-cover-placeholder.png';

  private readonly albumsCatalog = signal<StoredAlbum[]>(this.loadStorageArray<StoredAlbum>(this.ALBUMS_KEY));
  private readonly songsCatalog = signal<StoredSong[]>(this.loadStorageArray<StoredSong>(this.SONGS_KEY));
  private readonly artistsCatalog = signal<StoredArtist[]>(this.loadStorageArray<StoredArtist>(this.ARTISTS_KEY));

  readonly topAlbumsByMinutes = computed<RankedAlbumCard[]>(() => {
    const albums = this.albumsCatalog();
    const songs = this.songsCatalog();
    const artists = this.artistsCatalog();

    return albums
      .map(album => {
        const artist = artists.find(item => item.id === album.artistId);

        const totalSeconds = songs
          .filter(song => song.albumId === album.id)
          .reduce((total, song) => total + (song.durationSeconds ?? 0), 0);

        return {
          id: album.id,
          title: album.title,
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

    if (tab === 'TODAS') {
      return currentUrl === '/user/home';
    }

    if (tab === 'MUSICA') {
      return currentUrl === '/user/music';
    }

    if (tab === 'ESTACION') {
      return currentUrl === '/user/station';
    }

    return false;
  }

  goToAlbum(albumId: string): void {
    if (!albumId) return;
    this.router.navigate(['/user/album', albumId]);
  }

  private loadStorageArray<T>(storageKey: string): T[] {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }

  private formatMinutesLabel(totalSeconds: number): string {
    const totalMinutes = Math.max(1, Math.floor(totalSeconds / 60));
    return `${totalMinutes} minutos`;
  }
}