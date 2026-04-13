import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ArtistResponse, SongResponse } from 'lib-ruby-sdks/catalog-service';
import { SongCardComponent } from 'lib-ruby-core-ui';
import { LibraryState } from '../../state/library.state';
import { PlayerState, PlayerSong } from '../../state/player.state';
import { InteractionState } from '../../state/interaction.state';

type HomeTab = 'TODAS' | 'MUSICA' | 'ESTACION';

interface RankedAlbumCard {
  id: string;
  rank: number;
  title: string;
  artistName: string;
  coverUrl: string;
  totalMinutesLabel: string;
}

interface RecentSongCard {
  id: string;
  title: string;
  artistName: string;
  coverUrl: string;
}

@Component({
  selector: 'app-music',
  standalone: true,
  imports: [CommonModule, SongCardComponent],
  templateUrl: './music.component.html',
  styleUrls: ['./music.component.scss'],
})
export class MusicComponent {
  private readonly router = inject(Router);
  private readonly libraryState = inject(LibraryState);
  private readonly playerState = inject(PlayerState);
  private readonly interactionState = inject(InteractionState);

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

  readonly recentSongs = computed<RecentSongCard[]>(() => {
    const songs = this.libraryState.songs();
    const artists = this.libraryState.artists();

    return songs
      .slice()
      .sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))
      .slice(0, 6)
      .map((s: SongResponse) => {
        const artist = artists.find((a: ArtistResponse) => a.id === s.artist?.id);
        return {
          id: s.id ?? '',
          title: s.title ?? '',
          artistName: artist?.name ?? 'Artista desconocido',
          coverUrl: s.coverUrl ?? '',
        };
      });
  });

  constructor() {
    this.libraryState.loadNewReleases();
    this.libraryState.loadRecentSongs();
    this.libraryState.loadTopArtists();
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

  isSongPlaying(songId: string): boolean {
    const current = this.playerState.currentSong();
    return !!current && current.id === songId && this.playerState.isPlaying();
  }

  isSongLiked(songId: string): boolean {
    return this.interactionState.isSongLiked(songId);
  }

  playSong(songId: string): void {
    const songRes = this.libraryState.songs().find((s: SongResponse) => s.id === songId);
    if (!songRes) return;
    const song = this.toPlayerSong(songRes);
    const current = this.playerState.currentSong();

    if (current?.id === songId && this.playerState.isPlaying()) {
      this.playerState.pause(); return;
    }
    if (current?.id === songId && !this.playerState.isPlaying()) {
      this.playerState.resume(); return;
    }
    this.playerState.playSong(song);
  }

  toggleSongLike(songId: string): void {
    this.interactionState.toggleLike(songId);
  }

  private toPlayerSong(song: SongResponse): PlayerSong {
    return {
      id: song.id ?? '',
      title: song.title ?? '',
      artistId: song.artist?.id ?? '',
      albumId: song.album?.id ?? null,
      genreId: song.genres?.[0]?.id ?? '',
      coverUrl: song.coverUrl ?? '',
      audioUrl: song.audioUrl ?? '',
      durationSeconds: song.duration ?? 0,
      lyrics: song.lyrics ?? null,
      playCount: song.playCount ?? 0,
      likesCount: song.likesCount ?? 0,
      createdAt: '',
    };
  }

  private formatMinutesLabel(totalSeconds: number): string {
    const totalMinutes = Math.max(1, Math.floor(totalSeconds / 60));
    return `${totalMinutes} minutos`;
  }
}
