import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { SongResponse } from 'lib-ruby-sdks/catalog-service';
import { PlaylistResponse } from 'lib-ruby-sdks/playlist-service';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { PlayerState } from '../../state/player.state';
import { PlaylistState } from '../../state/playlist.state';
import { LibraryState } from '../../state/library.state';
import { InteractionState } from '../../state/interaction.state';

interface PopularSongRow {
  id: string;
  index: number;
  songId: string;
  title: string;
  artistId: string;
  artistName: string;
  albumId: string | null;
  albumTitle: string;
  coverUrl: string;
  playCount: number;
  playCountLabel: string;
  durationLabel: string;
  isLiked: boolean;
}

interface ArtistAlbumCard {
  id: string;
  title: string;
  coverUrl: string;
  releaseYear: string;
}

interface RelatedArtistCard {
  id: string;
  name: string;
  photoUrl: string;
}

@Component({
  selector: 'app-artist-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './artist-detail.component.html',
  styleUrls: ['./artist-detail.component.scss'],
})
export class ArtistDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authState = inject(AuthState);
  private readonly playlistState = inject(PlaylistState);
  private readonly playerState = inject(PlayerState);
  private readonly libraryState = inject(LibraryState);
  private readonly interactionState = inject(InteractionState);
  private readonly destroyRef = inject(DestroyRef);

  private readonly defaultTopColor = '#242424';
  private readonly defaultArtistPhoto = '/assets/icons/avatar-placeholder.png';
  private readonly defaultAlbumCover = '/assets/icons/playlist-cover-placeholder.png';

  readonly currentUser = this.authState.currentUser;
  readonly artistId = signal(this.route.snapshot.paramMap.get('id') ?? '');

  readonly showAllPopularSongs = signal(false);
  readonly isArtistMenuOpen = signal(false);

  readonly openSongMenuId = signal<string | null>(null);
  readonly openPlaylistSubmenuSongId = signal<string | null>(null);

  readonly openAlbumMenuId = signal<string | null>(null);
  readonly openAlbumPlaylistSubmenuId = signal<string | null>(null);

  readonly openRelatedArtistMenuId = signal<string | null>(null);

  readonly headerAccentColor = signal(this.defaultTopColor);

  private readonly _detailSongs = signal<SongResponse[]>([]);
  private readonly _detailLoading = signal(false);
  private readonly _detailError = signal<string | null>(null);
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly detailError = this._detailError.asReadonly();

  readonly currentArtist = computed<any>(() => {
    const id = this.artistId();
    if (!id) return null;
    return (this.libraryState.artists() as any[]).find(artist => artist.id === id) ?? null;
  });

  readonly displayArtistName = computed(() => {
    return this.currentArtist()?.name ?? 'Artista';
  });

  readonly displayArtistPhoto = computed(() => {
    return this.currentArtist()?.photoUrl || this.defaultArtistPhoto;
  });

  readonly monthlyListenersLabel = computed(() => {
    const raw = this.currentArtist()?.monthlyListeners ?? '0';
    const value = Number(raw) || 0;
    return `${this.formatNumber(value)} oyentes mensuales`;
  });

  readonly artistGradient = computed(() => {
    const color = this.headerAccentColor();
    return `linear-gradient(180deg, ${color} 0%, ${color} 28%, #141414 62%, #090909 100%)`;
  });

  readonly allArtistSongs = computed<any[]>(() => {
    return (this._detailSongs() as any[])
      .slice()
      .sort((a, b) => {
        const diff = (b.playCount ?? 0) - (a.playCount ?? 0);
        if (diff !== 0) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 10);
  });

  readonly popularSongs = computed<PopularSongRow[]>(() => {
    const user = this.currentUser();
    const songs = this.allArtistSongs();

    return songs.map((song, index) => {
      const album = song.albumId
        ? (this.libraryState.albums() as any[]).find(item => item.id === song.albumId)
        : null;

      return {
        id: `${song.artistId}-${song.id}`,
        index: index + 1,
        songId: song.id,
        title: song.title,
        artistId: song.artistId,
        artistName: this.displayArtistName(),
        albumId: song.albumId,
        albumTitle: album?.title ?? 'Sencillo',
        coverUrl: song.coverUrl || this.defaultAlbumCover,
        playCount: song.playCount ?? 0,
        playCountLabel: this.formatNumber(song.playCount ?? 0),
        durationLabel: this.formatDuration(song.durationSeconds),
        isLiked: this.interactionState.isSongLiked(song.id ?? ''),
      };
    });
  });

  readonly visiblePopularSongs = computed<PopularSongRow[]>(() => {
    const songs = this.popularSongs();
    return this.showAllPopularSongs() ? songs : songs.slice(0, 5);
  });

  readonly canTogglePopularSongs = computed(() => this.popularSongs().length > 5);
  readonly hasArtistSongs = computed(() => this.popularSongs().length > 0);

  readonly artistAlbums = computed<ArtistAlbumCard[]>(() => {
    const artist = this.currentArtist();
    if (!artist) return [];

    return (this.libraryState.albums() as any[])
      .filter(album => album.artistId === artist.id)
      .sort((a, b) => new Date(b.releaseDate || b.createdAt).getTime() - new Date(a.releaseDate || a.createdAt).getTime())
      .slice(0, 6)
      .map(album => ({
        id: album.id,
        title: album.title,
        coverUrl: album.coverUrl || this.defaultAlbumCover,
        releaseYear: this.extractYear(album.releaseDate || album.createdAt),
      }));
  });

  readonly hasArtistAlbums = computed(() => this.artistAlbums().length > 0);

  readonly relatedArtists = computed<RelatedArtistCard[]>(() => {
    const currentArtist = this.currentArtist();
    if (!currentArtist) return [];

    return (this.libraryState.artists() as any[])
      .filter(artist => artist.id !== currentArtist.id)
      .slice(0, 6)
      .map(artist => ({
        id: artist.id,
        name: artist.name,
        photoUrl: artist.photoUrl || this.defaultArtistPhoto,
      }));
  });

  readonly hasRelatedArtists = computed(() => this.relatedArtists().length > 0);

  readonly customPlaylists = computed<PlaylistResponse[]>(() => {
    const user = this.currentUser();
    if (!user?.id) return [];
    return this.playlistState.getCustomPlaylistsByUser(user.id);
  });

  readonly isArtistFollowed = computed(() => {
    const artist = this.currentArtist();
    if (!artist?.id) return false;
    return this.interactionState.isArtistFollowed(artist.id);
  });

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(paramMap => {
        const nextArtistId = paramMap.get('id') ?? '';

        this.artistId.set(nextArtistId);
        this.showAllPopularSongs.set(false);
        this.isArtistMenuOpen.set(false);
        this.closeSongMenu();
        this.closeAlbumMenu();
        this.closeRelatedArtistMenu();
        this.bootstrapArtistDetail();
        this.loadArtistSongs(nextArtistId);
        this.interactionState.loadFollowedArtists();

        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
  }

  /* ===================== */
  /* INIT */
  /* ===================== */
  private loadArtistSongs(artistId: string): void {
    if (!artistId) {
      this._detailSongs.set([]);
      return;
    }
    this._detailLoading.set(true);
    this._detailError.set(null);
    this.libraryState.getArtistSongs(artistId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (songs) => {
          this._detailSongs.set(songs);
          this._detailLoading.set(false);
        },
        error: (err: { message?: string }) => {
          this._detailError.set(err?.message ?? 'Error al cargar canciones del artista');
          this._detailLoading.set(false);
        },
      });
  }

  private bootstrapArtistDetail(): void {
    const artist = this.currentArtist();

    if (!artist) {
      this.headerAccentColor.set(this.defaultTopColor);
      return;
    }

    if (artist.photoUrl) {
      this.updateAccentFromImage(artist.photoUrl);
    } else {
      this.headerAccentColor.set(this.defaultTopColor);
    }
  }

  /* ===================== */
  /* FOLLOW / LIBRARY */
  /* ===================== */
  toggleFollowArtist(): void {
    const artist = this.currentArtist();
    if (!artist?.id) return;

    if (this.isArtistFollowed()) {
      this.interactionState.unfollowArtist(artist.id);
      this.isArtistMenuOpen.set(false);
      return;
    }

    this.interactionState.followArtist(artist.id);
    this.isArtistMenuOpen.set(false);
  }

  isRelatedArtistFollowed(artistId: string): boolean {
    return this.interactionState.isArtistFollowed(artistId);
  }

  toggleFollowRelatedArtist(artistId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!artistId) return;

    if (this.isRelatedArtistFollowed(artistId)) {
      this.interactionState.unfollowArtist(artistId);
      this.closeRelatedArtistMenu();
      return;
    }

    this.interactionState.followArtist(artistId);
    this.closeRelatedArtistMenu();
  }

  /* ===================== */
  /* ARTIST MENU */
  /* ===================== */
  toggleArtistMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isArtistMenuOpen.set(!this.isArtistMenuOpen());
    this.closeSongMenu();
    this.closeAlbumMenu();
    this.closeRelatedArtistMenu();
  }

  closeArtistMenu(): void {
    this.isArtistMenuOpen.set(false);
  }

  /* ===================== */
  /* PLAYBACK */
  /* ===================== */
  playArtist(): void {
    const firstSong = this.popularSongs()[0];
    if (!firstSong) return;

    if (this.isArtistPlaying()) {
      this.playerState.pause();
      return;
    }

    this.playSong(firstSong);
  }

  playSong(songRow: PopularSongRow): void {
    const storedSong = (this._detailSongs() as any[]).find(song => song.id === songRow.songId)
      ?? (this.libraryState.songs() as any[]).find(song => song.id === songRow.songId);
    if (!storedSong) return;

    if (this.isSongPlaying(songRow.songId)) {
      this.playerState.pause();
      return;
    }

    this.playerState.playSong(storedSong as any);
  }

  playAlbum(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    const firstSong = (this.libraryState.songs() as any[]).find(song => song.albumId === albumId);
    if (!firstSong) return;

    if (this.isAlbumPlaying(albumId)) {
      this.playerState.pause();
      return;
    }

    this.playerState.playSong(firstSong as any);
  }

  playRelatedArtist(artistId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    const firstSong = (this.libraryState.songs() as any[])
      .filter(song => song.artistId === artistId)
      .sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))[0];

    if (!firstSong) return;

    if (this.isRelatedArtistPlaying(artistId)) {
      this.playerState.pause();
      return;
    }

    this.playerState.playSong(firstSong as any);
  }

  isArtistPlaying(): boolean {
    const currentSong = this.playerState.currentSong();
    return !!currentSong && (currentSong as any).artistId === this.artistId() && this.playerState.isPlaying();
  }

  isSongPlaying(songId: string): boolean {
    const currentSong = this.playerState.currentSong();
    return !!currentSong && (currentSong as any).id === songId && this.playerState.isPlaying();
  }

  isAlbumPlaying(albumId: string): boolean {
    const currentSong = this.playerState.currentSong();
    return !!currentSong && (currentSong as any).albumId === albumId && this.playerState.isPlaying();
  }

  isRelatedArtistPlaying(artistId: string): boolean {
    const currentSong = this.playerState.currentSong();
    return !!currentSong && (currentSong as any).artistId === artistId && this.playerState.isPlaying();
  }

  /* ===================== */
  /* POPULAR SONGS */
  /* ===================== */
  togglePopularSongsExpansion(): void {
    this.showAllPopularSongs.set(!this.showAllPopularSongs());
  }

  /* ===================== */
  /* SONG MENU */
  /* ===================== */
  toggleSongMenu(songId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (this.openSongMenuId() === songId) {
      this.openSongMenuId.set(null);
      this.openPlaylistSubmenuSongId.set(null);
      return;
    }

    this.openSongMenuId.set(songId);
    this.openPlaylistSubmenuSongId.set(null);
    this.closeArtistMenu();
    this.closeAlbumMenu();
    this.closeRelatedArtistMenu();
  }

  togglePlaylistSubmenu(songId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (this.openPlaylistSubmenuSongId() === songId) {
      this.openPlaylistSubmenuSongId.set(null);
      return;
    }

    this.openPlaylistSubmenuSongId.set(songId);
  }

  closeSongMenu(): void {
    this.openSongMenuId.set(null);
    this.openPlaylistSubmenuSongId.set(null);
  }

  /* ===================== */
  /* LIKED SONGS */
  /* ===================== */
  isSongLiked(songId: string): boolean {
    return this.interactionState.isSongLiked(songId);
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
  /* SONG PLAYLISTS */
  /* ===================== */
  addSongToNewPlaylist(songId: string): void {
    const user = this.currentUser();
    if (!user?.id) return;

    const nextNumber = this.playlistState.getCustomPlaylistsByUser(user.id).length + 1;

    this.playlistState.createPlaylist(
      { name: `Mi playlist n.° ${nextNumber}`, description: null, isPublic: true },
      (created) => {
        this.playlistState.addSongToPlaylist(created.id!, songId);
        const storedSong = (this._detailSongs() as any[]).find(s => s.id === songId)
          ?? (this.libraryState.songs() as any[]).find(s => s.id === songId);
        if (storedSong?.coverUrl) {
          this.playlistState.updatePlaylist(created.id!, { coverUrl: storedSong.coverUrl });
        }
        this.closeSongMenu();
      }
    );
  }

  addSongToExistingPlaylist(playlistId: string, songId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (!playlistId || !songId) return;

    this.playlistState.addSongToPlaylist(playlistId, songId);

    const playlist = this.playlistState.playlists().find(item => item.id === playlistId);
    const storedSong = (this._detailSongs() as any[]).find(song => song.id === songId)
      ?? (this.libraryState.songs() as any[]).find(song => song.id === songId);

    if (playlist && !playlist.coverUrl && storedSong?.coverUrl) {
      this.playlistState.updatePlaylist(playlistId, { coverUrl: storedSong.coverUrl });
    }

    this.closeSongMenu();
  }

  /* ===================== */
  /* SONG NAVIGATION */
  /* ===================== */
  hasAlbum(song: PopularSongRow): boolean {
    return !!song.albumId;
  }

  goToAlbumFromSong(song: PopularSongRow, event?: MouseEvent): void {
    event?.stopPropagation();

    if (!song.albumId) return;

    this.closeSongMenu();
    this.router.navigate(['/user/album', song.albumId]);
  }

  /* ===================== */
  /* ARTIST ALBUMS */
  /* ===================== */
  toggleAlbumMenu(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (this.openAlbumMenuId() === albumId) {
      this.openAlbumMenuId.set(null);
      this.openAlbumPlaylistSubmenuId.set(null);
      return;
    }

    this.openAlbumMenuId.set(albumId);
    this.openAlbumPlaylistSubmenuId.set(null);
    this.closeArtistMenu();
    this.closeSongMenu();
    this.closeRelatedArtistMenu();
  }

  toggleAlbumPlaylistSubmenu(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (this.openAlbumPlaylistSubmenuId() === albumId) {
      this.openAlbumPlaylistSubmenuId.set(null);
      return;
    }

    this.openAlbumPlaylistSubmenuId.set(albumId);
  }

  closeAlbumMenu(): void {
    this.openAlbumMenuId.set(null);
    this.openAlbumPlaylistSubmenuId.set(null);
  }

  isArtistAlbumSaved(albumId: string): boolean {
    return this.interactionState.isAlbumInLibrary(albumId);
  }

  toggleSaveArtistAlbum(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!albumId) return;

    if (this.isArtistAlbumSaved(albumId)) {
      this.interactionState.removeAlbumFromLibrary(albumId);
      this.closeAlbumMenu();
      return;
    }

    this.interactionState.addAlbumToLibrary(albumId);
    this.closeAlbumMenu();
  }

  addArtistAlbumToNewPlaylist(albumId: string): void {
    const user = this.currentUser();
    if (!user?.id || !albumId) return;

    const nextNumber = this.playlistState.getCustomPlaylistsByUser(user.id).length + 1;

    this.playlistState.createPlaylist(
      { name: `Mi playlist n.° ${nextNumber}`, description: null, isPublic: true },
      (created) => {
        this.libraryState.getAlbumSongs(albumId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(albumSongs => {
            albumSongs.forEach(s => this.playlistState.addSongToPlaylist(created.id!, s.id!));
            const firstSong = albumSongs[0];
            if (firstSong?.coverUrl) {
              this.playlistState.updatePlaylist(created.id!, { coverUrl: firstSong.coverUrl });
            }
            this.closeAlbumMenu();
          });
      }
    );
  }

  addArtistAlbumToExistingPlaylist(playlistId: string, albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (!playlistId || !albumId) return;

    this.libraryState.getAlbumSongs(albumId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(albumSongs => {
        albumSongs.forEach(song => {
          this.playlistState.addSongToPlaylist(playlistId, song.id!);
        });

        const playlist = this.playlistState.playlists().find(item => item.id === playlistId);
        const firstSong = albumSongs[0];

        if (playlist && !playlist.coverUrl && firstSong?.coverUrl) {
          this.playlistState.updatePlaylist(playlistId, { coverUrl: firstSong.coverUrl });
        }

        this.closeAlbumMenu();
      });
  }

  goToAlbumDetail(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!albumId) return;

    this.closeAlbumMenu();
    this.router.navigate(['/user/album', albumId]);
  }

  /* ===================== */
  /* RELATED ARTISTS */
  /* ===================== */
  toggleRelatedArtistMenu(artistId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (this.openRelatedArtistMenuId() === artistId) {
      this.openRelatedArtistMenuId.set(null);
      return;
    }

    this.openRelatedArtistMenuId.set(artistId);
    this.closeArtistMenu();
    this.closeSongMenu();
    this.closeAlbumMenu();
  }

  closeRelatedArtistMenu(): void {
    this.openRelatedArtistMenuId.set(null);
  }

  goToArtistDetail(artistId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!artistId) return;

    this.closeRelatedArtistMenu();
    this.router.navigate(['/user/artist', artistId]);
  }

  /* ===================== */
  /* HELPERS */
  /* ===================== */
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeArtistMenu();
    this.closeSongMenu();
    this.closeAlbumMenu();
    this.closeRelatedArtistMenu();
  }

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
