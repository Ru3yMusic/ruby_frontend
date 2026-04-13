import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SongResponse, ArtistResponse, AlbumResponse } from 'lib-ruby-sdks/catalog-service';
import { PlaylistResponse } from 'lib-ruby-sdks/playlist-service';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { PlayerState, PlayerSong } from '../../state/player.state';
import { PlaylistState } from '../../state/playlist.state';
import { LibraryState } from '../../state/library.state';
import { InteractionState } from '../../state/interaction.state';

type HomeTab = 'TODAS' | 'MUSICA' | 'ESTACION';

interface HomeAlbumCard {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  coverUrl: string;
}

interface HomeSongRow {
  id: string;
  songId: string;
  title: string;
  artistId: string;
  artistName: string;
  albumId: string | null;
  albumTitle: string;
  coverUrl: string;
  isLiked: boolean;
}

interface HomeRecommendedArtistCard {
  id: string;
  name: string;
  photoUrl: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly router = inject(Router);
  private readonly authState = inject(AuthState);
  private readonly playlistState = inject(PlaylistState);
  private readonly playerState = inject(PlayerState);
  private readonly libraryState = inject(LibraryState);
  private readonly interactionState = inject(InteractionState);

  private readonly defaultAvatar = '/assets/icons/avatar-placeholder.png';
  private readonly defaultAlbumCover = '/assets/icons/playlist-cover-placeholder.png';

  readonly currentUser = this.authState.currentUser;
  readonly loading = this.libraryState.loading;

  readonly activeTab = signal<HomeTab>('TODAS');
  readonly albumsCarouselIndex = signal(0);
  readonly artistsCarouselIndex = signal(0);
  readonly randomListenSongIds = signal<string[]>([]);
  readonly randomRecommendedArtistIds = signal<string[]>([]);
  readonly openAlbumMenuId = signal<string | null>(null);
  readonly openAlbumPlaylistSubmenuId = signal<string | null>(null);
  readonly openSongMenuId = signal<string | null>(null);
  readonly openSongPlaylistSubmenuId = signal<string | null>(null);

  /* ===================== */
  /* COMPUTED — catalog */
  /* ===================== */

  readonly customPlaylists = computed<PlaylistResponse[]>(() => {
    const user = this.currentUser();
    if (!user?.id) return [];
    return this.playlistState.getCustomPlaylistsByUser(user.id);
  });

  readonly albumsForYou = computed<HomeAlbumCard[]>(() => {
    return this.libraryState
      .albums()
      .map((album: AlbumResponse) => {
      const artist = this.libraryState.artists().find((a: ArtistResponse) => a.id === album.artist?.id);
      return {
        id: album.id ?? '',
        title: album.title ?? '',
        artistId: album.artist?.id ?? '',
          artistName: artist?.name ?? 'Artista desconocido',
          coverUrl: album.coverUrl || this.defaultAlbumCover,
        };
      })
      .slice(0, 12);
  });

  readonly visibleAlbumsForYou = computed<HomeAlbumCard[]>(() => {
    const start = this.albumsCarouselIndex();
    return this.albumsForYou().slice(start, start + 7);
  });

  readonly canMoveAlbumsLeft = computed(() => this.albumsCarouselIndex() > 0);

  readonly canMoveAlbumsRight = computed(() => {
    return this.albumsCarouselIndex() + 7 < this.albumsForYou().length;
  });

  readonly listenNowSongs = computed<HomeSongRow[]>(() => {
    return this.randomListenSongIds()
      .map(songId => this.libraryState.songs().find((s: SongResponse) => s.id === songId))
      .filter((song): song is SongResponse => !!song)
      .map(song => {
      const artist = this.libraryState.artists().find((a: ArtistResponse) => a.id === song.artist?.id);
      const album = song.album?.id
        ? this.libraryState.albums().find((a: AlbumResponse) => a.id === song.album?.id)
        : null;

      return {
        id: `home-song-${song.id ?? ''}`,
        songId: song.id ?? '',
        title: song.title ?? '',
        artistId: song.artist?.id ?? '',
        artistName: artist?.name ?? 'Artista desconocido',
        albumId: song.album?.id ?? null,
          albumTitle: album?.title ?? 'Sencillo',
          coverUrl: song.coverUrl || this.defaultAlbumCover,
          isLiked: this.interactionState.isSongLiked(song.id ?? ''),
        };
      });
  });

  readonly recommendedArtists = computed<HomeRecommendedArtistCard[]>(() => {
    return this.randomRecommendedArtistIds()
      .map(artistId => this.libraryState.artists().find((a: ArtistResponse) => a.id === artistId))
      .filter((artist): artist is ArtistResponse => !!artist)
      .map(artist => ({
        id: artist.id ?? '',
        name: artist.name ?? '',
        photoUrl: artist.photoUrl || this.defaultAvatar,
      }));
  });

  readonly visibleRecommendedArtists = computed<HomeRecommendedArtistCard[]>(() => {
    const start = this.artistsCarouselIndex();
    return this.recommendedArtists().slice(start, start + 7);
  });

  readonly canMoveArtistsLeft = computed(() => this.artistsCarouselIndex() > 0);

  readonly canMoveArtistsRight = computed(() => {
    return this.artistsCarouselIndex() + 7 < this.recommendedArtists().length;
  });

  constructor() {
    // Seed random sections reactively once data loads
    effect(() => {
      const songs = this.libraryState.songs();
      if (songs.length > 0 && this.randomListenSongIds().length === 0) {
        this.refreshListenNowSongs();
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const artists = this.libraryState.artists();
      if (artists.length > 0 && this.randomRecommendedArtistIds().length === 0) {
        this.refreshRecommendedArtists();
      }
    }, { allowSignalWrites: true });

    this.bootstrapHome();
  }

  /* ===================== */
  /* INIT */
  /* ===================== */
  private bootstrapHome(): void {
    this.libraryState.loadRecentSongs();
    this.libraryState.loadTopArtists();
    this.libraryState.loadNewReleases();
    this.interactionState.loadLikedSongs();
    this.interactionState.loadLibraryAlbums();
    this.interactionState.loadLibraryArtists();
    this.playlistState.loadPlaylists();
  }

  /* ===================== */
  /* TABS */
  /* ===================== */
  setActiveTab(tab: HomeTab): void {
    if (tab === 'TODAS') { this.router.navigate(['/user/home']); return; }
    if (tab === 'MUSICA') { this.router.navigate(['/user/music']); return; }
    if (tab === 'ESTACION') { this.router.navigate(['/user/station']); }
  }

  isTabActive(tab: HomeTab): boolean {
    const url = this.router.url;
    if (tab === 'TODAS') return url === '/user/home';
    if (tab === 'MUSICA') return url === '/user/music';
    if (tab === 'ESTACION') return url === '/user/station';
    return false;
  }

  /* ===================== */
  /* CAROUSELS */
  /* ===================== */
  moveAlbumsLeft(): void {
    if (!this.canMoveAlbumsLeft()) return;
    this.albumsCarouselIndex.update(v => Math.max(0, v - 1));
  }

  moveAlbumsRight(): void {
    if (!this.canMoveAlbumsRight()) return;
    this.albumsCarouselIndex.update(v => v + 1);
  }

  moveArtistsLeft(): void {
    if (!this.canMoveArtistsLeft()) return;
    this.artistsCarouselIndex.update(v => Math.max(0, v - 1));
  }

  moveArtistsRight(): void {
    if (!this.canMoveArtistsRight()) return;
    this.artistsCarouselIndex.update(v => v + 1);
  }

  /* ===================== */
  /* RANDOM SECTIONS */
  /* ===================== */
  refreshListenNowSongs(): void {
    const shuffled = this.shuffleArray(this.libraryState.songs())
      .slice(0, 4)
      .map(s => s.id ?? '');
    this.randomListenSongIds.set(shuffled);
  }

  refreshRecommendedArtists(): void {
    const followedIds = new Set(this.interactionState.libraryArtistIds());
    const available = this.libraryState.artists().filter(a => !followedIds.has(a.id ?? ''));
    const shuffled = this.shuffleArray(available)
      .slice(0, 12)
      .map(a => a.id ?? '');
    this.randomRecommendedArtistIds.set(shuffled);
    this.artistsCarouselIndex.set(0);
  }

  /* ===================== */
  /* PLAYBACK */
  /* ===================== */
  playAlbum(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    const firstSongRes = this.libraryState.songs().find(s => s.album?.id === albumId);
    if (!firstSongRes) return;
    const firstSong = this.toPlayerSong(firstSongRes);
    const current = this.playerState.currentSong();

    if (current?.albumId === albumId && current.id === firstSong.id && this.playerState.isPlaying()) {
      this.playerState.pause(); return;
    }
    if (current?.albumId === albumId && current.id === firstSong.id && !this.playerState.isPlaying()) {
      this.playerState.resume(); return;
    }
    this.playerState.playSong(firstSong);
  }

  isAlbumPlaying(albumId: string): boolean {
    const current = this.playerState.currentSong();
    return !!current && current.albumId === albumId && this.playerState.isPlaying();
  }

  playSong(songId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    const songRes = this.libraryState.songs().find(s => s.id === songId);
    if (!songRes) return;

    if (this.isSongPlaying(songId)) { this.playerState.pause(); return; }
    this.playerState.playSong(this.toPlayerSong(songRes));
  }

  isSongPlaying(songId: string): boolean {
    const current = this.playerState.currentSong();
    return !!current && current.id === songId && this.playerState.isPlaying();
  }

  playArtist(artistId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    const songs = this.libraryState.songs()
      .filter(s => s.artist?.id === artistId)
      .sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0));

    const firstSongRes = songs[0];
    if (!firstSongRes) return;
    const firstSong = this.toPlayerSong(firstSongRes);
    const current = this.playerState.currentSong();

    if (current?.artistId === artistId && current.id === firstSong.id && this.playerState.isPlaying()) {
      this.playerState.pause(); return;
    }
    if (current?.artistId === artistId && current.id === firstSong.id && !this.playerState.isPlaying()) {
      this.playerState.resume(); return;
    }
    this.playerState.playSong(firstSong);
  }

  isArtistPlaying(artistId: string): boolean {
    const current = this.playerState.currentSong();
    return !!current && current.artistId === artistId && this.playerState.isPlaying();
  }

  /* ===================== */
  /* ALBUM MENU */
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
    this.closeSongMenu();
  }

  toggleAlbumPlaylistSubmenu(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.openAlbumPlaylistSubmenuId.set(
      this.openAlbumPlaylistSubmenuId() === albumId ? null : albumId
    );
  }

  closeAlbumMenu(): void {
    this.openAlbumMenuId.set(null);
    this.openAlbumPlaylistSubmenuId.set(null);
  }

  isAlbumSaved(albumId: string): boolean {
    return this.interactionState.isAlbumInLibrary(albumId);
  }

  toggleSaveAlbum(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!albumId) return;

    if (this.interactionState.isAlbumInLibrary(albumId)) {
      this.interactionState.removeAlbumFromLibrary(albumId);
    } else {
      this.interactionState.addAlbumToLibrary(albumId);
    }
    this.closeAlbumMenu();
  }

  addAlbumToNewPlaylist(albumId: string): void {
    const user = this.currentUser();
    if (!user?.id || !albumId) return;

    const nextNumber = this.playlistState.getCustomPlaylistsByUser(user.id).length + 1;

    this.playlistState.createPlaylist(
      { name: `Mi playlist n.° ${nextNumber}`, description: null, isPublic: true },
      (created) => {
        const albumSongs = this.libraryState.songs().filter(s => s.album?.id === albumId);
        albumSongs.forEach(song => {
          this.playlistState.addSongToPlaylist(created.id!, song.id!);
        });
        this.closeAlbumMenu();
      }
    );
  }

  addAlbumToExistingPlaylist(playlistId: string, albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!playlistId || !albumId) return;

    const albumSongs = this.libraryState.songs().filter(s => s.album?.id === albumId);
    albumSongs.forEach(song => {
      this.playlistState.addSongToPlaylist(playlistId, song.id!);
    });
    this.closeAlbumMenu();
  }

  /* ===================== */
  /* SONG MENU */
  /* ===================== */
  toggleSongMenu(songId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.openSongMenuId() === songId) {
      this.openSongMenuId.set(null);
      this.openSongPlaylistSubmenuId.set(null);
      return;
    }
    this.openSongMenuId.set(songId);
    this.openSongPlaylistSubmenuId.set(null);
    this.closeAlbumMenu();
  }

  toggleSongPlaylistSubmenu(songId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.openSongPlaylistSubmenuId.set(
      this.openSongPlaylistSubmenuId() === songId ? null : songId
    );
  }

  closeSongMenu(): void {
    this.openSongMenuId.set(null);
    this.openSongPlaylistSubmenuId.set(null);
  }

  isSongLiked(songId: string): boolean {
    return this.interactionState.isSongLiked(songId);
  }

  toggleSongLike(songId: string): void {
    this.interactionState.toggleLike(songId);
    this.closeSongMenu();
  }

  addSongToNewPlaylist(songId: string): void {
    const user = this.currentUser();
    if (!user?.id) return;

    const nextNumber = this.playlistState.getCustomPlaylistsByUser(user.id).length + 1;

    this.playlistState.createPlaylist(
      { name: `Mi playlist n.° ${nextNumber}`, description: null, isPublic: true },
      (created) => {
        this.playlistState.addSongToPlaylist(created.id!, songId);
        this.closeSongMenu();
      }
    );
  }

  addSongToExistingPlaylist(playlistId: string, songId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!playlistId || !songId) return;
    this.playlistState.addSongToPlaylist(playlistId, songId);
    this.closeSongMenu();
  }

  /* ===================== */
  /* FOLLOW ARTIST */
  /* ===================== */
  isArtistFollowed(artistId: string): boolean {
    return this.interactionState.isArtistInLibrary(artistId);
  }

  followArtistFromRecommended(artistId: string): void {
    if (!artistId || this.interactionState.isArtistInLibrary(artistId)) return;
    this.interactionState.addArtistToLibrary(artistId);

    setTimeout(() => {
      this.randomRecommendedArtistIds.set(
        this.randomRecommendedArtistIds().filter(id => id !== artistId)
      );
    }, 1000);
  }

  /* ===================== */
  /* NAVIGATION */
  /* ===================== */
  goToAlbumDetail(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!albumId) return;
    this.closeAlbumMenu();
    this.router.navigate(['/user/album', albumId]);
  }

  goToArtistDetail(artistId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!artistId) return;
    this.closeSongMenu();
    this.router.navigate(['/user/artist', artistId]);
  }

  goToSongDetail(songId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.router.navigate(['/user/song', songId]);
  }

  goToAlbumFromSong(song: HomeSongRow, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!song.albumId) return;
    this.closeSongMenu();
    this.router.navigate(['/user/album', song.albumId]);
  }

  hasAlbum(song: HomeSongRow): boolean {
    return !!song.albumId;
  }

  /* ===================== */
  /* HELPERS */
  /* ===================== */
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeAlbumMenu();
    this.closeSongMenu();
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

  private shuffleArray<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}
