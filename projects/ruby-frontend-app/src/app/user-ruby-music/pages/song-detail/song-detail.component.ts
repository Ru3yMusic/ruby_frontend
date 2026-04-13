import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { PlaylistResponse } from 'lib-ruby-sdks/playlist-service';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { PlayerState } from '../../state/player.state';
import { PlaylistState } from '../../state/playlist.state';
import { LibraryState } from '../../state/library.state';
import { InteractionState } from '../../state/interaction.state';

interface AlbumSongRow {
  id: string;
  index: number;
  songId: string;
  title: string;
  artistId: string;
  artistName: string;
  durationLabel: string;
  isLiked: boolean;
}

@Component({
  selector: 'app-song-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './song-detail.component.html',
  styleUrls: ['./song-detail.component.scss'],
})
export class SongDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authState = inject(AuthState);
  private readonly playlistState = inject(PlaylistState);
  private readonly playerState = inject(PlayerState);
  private readonly libraryState = inject(LibraryState);
  private readonly interactionState = inject(InteractionState);
  private readonly destroyRef = inject(DestroyRef);

  private readonly defaultTopColor = '#6c1018';
  private readonly defaultSongCover = '/assets/icons/playlist-cover-placeholder.png';
  private readonly defaultArtistPhoto = '/assets/icons/avatar-placeholder.png';
  private readonly lyricsPreviewLimit = 8;

  readonly currentUser = this.authState.currentUser;
  readonly songId = signal(this.route.snapshot.paramMap.get('id') ?? '');

  readonly openSongMenu = signal(false);
  readonly openPlaylistSubmenu = signal(false);
  readonly showFullLyrics = signal(false);

  readonly headerAccentColor = signal(this.defaultTopColor);

  readonly currentSong = computed<any>(() => {
    const id = this.songId();
    if (!id) return null;
    return (this.libraryState.songs() as any[]).find(song => song.id === id) ?? null;
  });

  readonly currentArtist = computed<any>(() => {
    const song = this.currentSong();
    if (!song) return null;
    return (this.libraryState.artists() as any[]).find(artist => artist.id === song.artistId) ?? null;
  });

  readonly currentAlbum = computed<any>(() => {
    const song = this.currentSong();
    if (!song?.albumId) return null;
    return (this.libraryState.albums() as any[]).find(album => album.id === song.albumId) ?? null;
  });

  readonly displaySongTitle = computed(() => {
    return this.currentSong()?.title ?? 'Canción';
  });

  readonly displaySongCover = computed(() => {
    return this.currentSong()?.coverUrl || this.defaultSongCover;
  });

  readonly displayArtistName = computed(() => {
    return this.currentArtist()?.name ?? 'Artista desconocido';
  });

  readonly displayArtistPhoto = computed(() => {
    return this.currentArtist()?.photoUrl || this.defaultArtistPhoto;
  });

  readonly displayAlbumTitle = computed(() => {
    return this.currentAlbum()?.title ?? 'Sencillo';
  });

  readonly displayReleaseYear = computed(() => {
    const album = this.currentAlbum();
    if (!album) return '';
    return this.extractYear(album.releaseDate || album.createdAt);
  });

  readonly displayDurationLabel = computed(() => {
    return this.formatDuration(this.currentSong()?.durationSeconds ?? 0);
  });

  readonly displayPlayCountLabel = computed(() => {
    return this.formatNumber(this.currentSong()?.playCount ?? 0);
  });

  readonly songGradient = computed(() => {
    const color = this.headerAccentColor();
    return `linear-gradient(180deg, ${color} 0%, ${color} 34%, #121212 72%, #090909 100%)`;
  });

  readonly customPlaylists = computed<PlaylistResponse[]>(() => {
    const user = this.currentUser();
    if (!user?.id) return [];
    return this.playlistState.getCustomPlaylistsByUser(user.id);
  });

  readonly isCurrentSongLiked = computed(() => {
    const song = this.currentSong();
    if (!song) return false;
    return this.isSongLiked(song.id);
  });

  readonly albumSongs = computed<AlbumSongRow[]>(() => {
    const album = this.currentAlbum();
    const user = this.currentUser();

    if (!album) return [];

    return (this.libraryState.songs() as any[])
      .filter(song => song.albumId === album.id)
      .map((song, index) => ({
        id: `${album.id}-${song.id}`,
        index: index + 1,
        songId: song.id,
        title: song.title,
        artistId: song.artistId,
        artistName: this.displayArtistName(),
        durationLabel: this.formatDuration(song.durationSeconds),
        isLiked: this.interactionState.isSongLiked(song.id ?? ''),
      }));
  });

  readonly hasAlbumSongs = computed(() => this.albumSongs().length > 0);

  readonly normalizedLyricsLines = computed<string[]>(() => {
    const rawLyrics = this.currentSong()?.lyrics ?? '';
    if (!rawLyrics.trim()) return [];

    return rawLyrics
      .replace(/\r/g, '')
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
  });

  readonly hasLyrics = computed(() => this.normalizedLyricsLines().length > 0);

  readonly hasLongLyrics = computed(() => {
    return this.normalizedLyricsLines().length > this.lyricsPreviewLimit;
  });

  readonly visibleLyricsLines = computed<string[]>(() => {
    const lines = this.normalizedLyricsLines();
    if (this.showFullLyrics()) return lines;
    return lines.slice(0, this.lyricsPreviewLimit);
  });

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(paramMap => {
        const nextSongId = paramMap.get('id') ?? '';

        this.songId.set(nextSongId);
        this.openSongMenu.set(false);
        this.openPlaylistSubmenu.set(false);
        this.showFullLyrics.set(false);
        this.bootstrapSongDetail();

        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
  }

  /* ===================== */
  /* INIT */
  /* ===================== */
  private bootstrapSongDetail(): void {
    const song = this.currentSong();

    if (!song) {
      this.headerAccentColor.set(this.defaultTopColor);
      return;
    }

    if (song.coverUrl) {
      this.updateAccentFromImage(song.coverUrl);
    } else {
      this.headerAccentColor.set(this.defaultTopColor);
    }
  }

  /* ===================== */
  /* PLAYBACK */
  /* ===================== */
  playCurrentSong(): void {
    const song = this.currentSong();
    if (!song) return;

    if (this.isCurrentSongPlaying()) {
      this.playerState.pause();
      return;
    }

    this.playerState.playSong(song as any);
  }

  playAlbumSong(songRow: AlbumSongRow): void {
    const storedSong = (this.libraryState.songs() as any[]).find(song => song.id === songRow.songId);
    if (!storedSong) return;

    if (this.isAlbumSongPlaying(songRow.songId)) {
      this.playerState.pause();
      return;
    }

    this.playerState.playSong(storedSong as any);
  }

  isCurrentSongPlaying(): boolean {
    const currentPlayerSong = this.playerState.currentSong();
    return !!currentPlayerSong && (currentPlayerSong as any).id === this.songId() && this.playerState.isPlaying();
  }

  isAlbumSongPlaying(songId: string): boolean {
    const currentPlayerSong = this.playerState.currentSong();
    return !!currentPlayerSong && (currentPlayerSong as any).id === songId && this.playerState.isPlaying();
  }

  isDetailSong(songId: string): boolean {
    return this.songId() === songId;
  }

  /* ===================== */
  /* SONG MENU */
  /* ===================== */
  toggleSongMenu(event?: MouseEvent): void {
    event?.stopPropagation();

    if (this.openSongMenu()) {
      this.openSongMenu.set(false);
      this.openPlaylistSubmenu.set(false);
      return;
    }

    this.openSongMenu.set(true);
    this.openPlaylistSubmenu.set(false);
  }

  togglePlaylistSubmenu(event?: MouseEvent): void {
    event?.stopPropagation();
    this.openPlaylistSubmenu.set(!this.openPlaylistSubmenu());
  }

  closeSongMenu(): void {
    this.openSongMenu.set(false);
    this.openPlaylistSubmenu.set(false);
  }

  /* ===================== */
  /* LIKED SONGS */
  /* ===================== */
  isSongLiked(songId: string): boolean {
    return this.interactionState.isSongLiked(songId);
  }

  toggleCurrentSongLike(): void {
    const song = this.currentSong();
    if (!song) return;
    this.toggleSongLike(song.id);
  }

  toggleSongLike(songId: string): void {
    if (this.interactionState.isSongLiked(songId)) {
      this.interactionState.unlikeSong(songId);
    } else {
      this.interactionState.likeSong(songId);
    }
    this.closeSongMenu();
  }

  /* ===================== */
  /* PLAYLISTS */
  /* ===================== */
  addCurrentSongToNewPlaylist(): void {
    const song = this.currentSong();
    if (!song) return;
    this.addSongToNewPlaylist(song.id);
  }

  addSongToNewPlaylist(songId: string): void {
    const user = this.currentUser();
    if (!user?.id) return;

    const nextNumber = this.playlistState.getCustomPlaylistsByUser(user.id).length + 1;

    this.playlistState.createPlaylist(
      { name: `Mi playlist n.° ${nextNumber}`, description: null, isPublic: true },
      (created) => {
        this.playlistState.addSongToPlaylist(created.id!, songId);
        const storedSong = (this.libraryState.songs() as any[]).find(s => s.id === songId);
        if (storedSong?.coverUrl) {
          this.playlistState.updatePlaylist(created.id!, { coverUrl: storedSong.coverUrl });
        }
        this.closeSongMenu();
      }
    );
  }

  addCurrentSongToExistingPlaylist(playlistId: string, event?: MouseEvent): void {
    const song = this.currentSong();
    if (!song) return;
    this.addSongToExistingPlaylist(playlistId, song.id, event);
  }

  addSongToExistingPlaylist(playlistId: string, songId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (!playlistId || !songId) return;

    this.playlistState.addSongToPlaylist(playlistId, songId);

    const playlist = this.playlistState.playlists().find(item => item.id === playlistId);
    const storedSong = (this.libraryState.songs() as any[]).find(song => song.id === songId);

    if (playlist && !playlist.coverUrl && storedSong?.coverUrl) {
      this.playlistState.updatePlaylist(playlistId, { coverUrl: storedSong.coverUrl });
    }

    this.closeSongMenu();
  }

  /* ===================== */
  /* NAVIGATION */
  /* ===================== */
  goToArtist(event?: MouseEvent): void {
    event?.stopPropagation();

    const artist = this.currentArtist();
    if (!artist?.id) return;

    this.closeSongMenu();
    this.router.navigate(['/user/artist', artist.id]);
  }

  goToAlbum(event?: MouseEvent): void {
    event?.stopPropagation();

    const album = this.currentAlbum();
    if (!album?.id) return;

    this.closeSongMenu();
    this.router.navigate(['/user/album', album.id]);
  }

  goToSongDetail(songId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!songId) return;
    this.router.navigate(['/user/song', songId]);
  }

  hasAlbum(): boolean {
    return !!this.currentSong()?.albumId;
  }

  /* ===================== */
  /* LYRICS */
  /* ===================== */
  toggleLyricsExpansion(): void {
    this.showFullLyrics.set(!this.showFullLyrics());
  }

  /* ===================== */
  /* CLICK FUERA */
  /* ===================== */
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeSongMenu();
  }

  /* ===================== */
  /* HELPERS */
  /* ===================== */
  private formatDuration(totalSeconds: number): string {
    const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  private extractYear(value: string | null | undefined): string {
    if (!value) return '';
    const match = value.match(/\d{4}/);
    return match?.[0] ?? '';
  }

  private updateAccentFromImage(imageUrl: string): void {
    const image = new Image();
    image.crossOrigin = 'anonymous';

    image.onload = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        this.headerAccentColor.set(this.defaultTopColor);
        return;
      }

      const sampleWidth = 64;
      const sampleHeight = 64;

      canvas.width = sampleWidth;
      canvas.height = sampleHeight;

      context.drawImage(image, 0, 0, sampleWidth, sampleHeight);

      const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight);

      let red = 0;
      let green = 0;
      let blue = 0;
      let total = 0;

      for (let index = 0; index < data.length; index += 4) {
        const alpha = data[index + 3];
        if (alpha < 120) continue;

        red += data[index];
        green += data[index + 1];
        blue += data[index + 2];
        total++;
      }

      if (!total) {
        this.headerAccentColor.set(this.defaultTopColor);
        return;
      }

      const avgRed = Math.round(red / total);
      const avgGreen = Math.round(green / total);
      const avgBlue = Math.round(blue / total);

      this.headerAccentColor.set(this.softenRgb(avgRed, avgGreen, avgBlue));
    };

    image.onerror = () => {
      this.headerAccentColor.set(this.defaultTopColor);
    };

    image.src = imageUrl;
  }

  private softenRgb(r: number, g: number, b: number): string {
    const soften = (value: number) => Math.min(255, Math.round(value * 0.7));
    return `rgb(${soften(r)}, ${soften(g)}, ${soften(b)})`;
  }
}
