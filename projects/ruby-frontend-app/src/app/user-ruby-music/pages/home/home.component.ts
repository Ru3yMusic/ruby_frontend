import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { Playlist } from '../../models/playlist.model';
import { PlayerState } from '../../state/player.state';
import { PlaylistState } from '../../state/playlist.state';

type HomeTab = 'TODAS' | 'MUSICA' | 'ESTACION';

interface LibraryItem {
  id: string;
  userId: string;
  itemType: 'ARTIST' | 'ALBUM';
  itemId: string;
  addedAt: string;
}

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

  private readonly ARTISTS_KEY = 'ruby_artists';
  private readonly ALBUMS_KEY = 'ruby_albums';
  private readonly SONGS_KEY = 'ruby_songs';
  private readonly USER_LIBRARY_KEY = 'ruby_user_library';

  private readonly defaultAvatar = '/assets/icons/avatar-placeholder.png';
  private readonly defaultAlbumCover = '/assets/icons/playlist-cover-placeholder.png';

  readonly currentUser = this.authState.currentUser;

  readonly activeTab = signal<HomeTab>('TODAS');

  readonly albumsCarouselIndex = signal(0);
  readonly artistsCarouselIndex = signal(0);

  readonly randomListenSongIds = signal<string[]>([]);
  readonly randomRecommendedArtistIds = signal<string[]>([]);

  readonly openAlbumMenuId = signal<string | null>(null);
  readonly openAlbumPlaylistSubmenuId = signal<string | null>(null);

  readonly openSongMenuId = signal<string | null>(null);
  readonly openSongPlaylistSubmenuId = signal<string | null>(null);

  readonly artistsCatalog = signal<StoredArtist[]>(this.loadStorageArray<StoredArtist>(this.ARTISTS_KEY));
  readonly albumsCatalog = signal<StoredAlbum[]>(this.loadStorageArray<StoredAlbum>(this.ALBUMS_KEY));
  readonly songsCatalog = signal<StoredSong[]>(this.loadStorageArray<StoredSong>(this.SONGS_KEY));
  readonly userLibrary = signal<LibraryItem[]>(this.loadStorageArray<LibraryItem>(this.USER_LIBRARY_KEY));

  readonly customPlaylists = computed<Playlist[]>(() => {
    const user = this.currentUser();
    if (!user?.id) return [];

    return this.playlistState.getCustomPlaylistsByUser(user.id);
  });

  readonly albumsForYou = computed<HomeAlbumCard[]>(() => {
    return this.albumsCatalog()
      .map(album => {
        const artist = this.artistsCatalog().find(item => item.id === album.artistId);

        return {
          id: album.id,
          title: album.title,
          artistId: album.artistId,
          artistName: artist?.name ?? 'Artista desconocido',
          coverUrl: album.coverUrl || this.defaultAlbumCover,
        };
      })
      .slice(0, 12);
  });

  readonly visibleAlbumsForYou = computed<HomeAlbumCard[]>(() => {
    const cards = this.albumsForYou();
    const start = this.albumsCarouselIndex();
    return cards.slice(start, start + 7);
  });

  readonly canMoveAlbumsLeft = computed(() => this.albumsCarouselIndex() > 0);

  readonly canMoveAlbumsRight = computed(() => {
    const cards = this.albumsForYou();
    return this.albumsCarouselIndex() + 7 < cards.length;
  });

  readonly listenNowSongs = computed<HomeSongRow[]>(() => {
    const user = this.currentUser();

    const likedPlaylist = user?.id
      ? this.playlistState.getLikedSongsPlaylist(user.id) ?? this.playlistState.ensureLikedSongsPlaylist(user.id)
      : undefined;

    return this.randomListenSongIds()
      .map(songId => this.songsCatalog().find(song => song.id === songId))
      .filter((song): song is StoredSong => !!song)
      .map(song => {
        const artist = this.artistsCatalog().find(item => item.id === song.artistId);
        const album = song.albumId
          ? this.albumsCatalog().find(item => item.id === song.albumId)
          : null;

        return {
          id: `home-song-${song.id}`,
          songId: song.id,
          title: song.title,
          artistId: song.artistId,
          artistName: artist?.name ?? 'Artista desconocido',
          albumId: song.albumId,
          albumTitle: album?.title ?? 'Sencillo',
          coverUrl: song.coverUrl || this.defaultAlbumCover,
          isLiked: likedPlaylist?.songIds.includes(song.id) ?? false,
        };
      });
  });

  readonly recommendedArtists = computed<HomeRecommendedArtistCard[]>(() => {
    return this.randomRecommendedArtistIds()
      .map(artistId => this.artistsCatalog().find(artist => artist.id === artistId))
      .filter((artist): artist is StoredArtist => !!artist)
      .map(artist => ({
        id: artist.id,
        name: artist.name,
        photoUrl: artist.photoUrl || this.defaultAvatar,
      }));
  });

  readonly visibleRecommendedArtists = computed<HomeRecommendedArtistCard[]>(() => {
    const cards = this.recommendedArtists();
    const start = this.artistsCarouselIndex();
    return cards.slice(start, start + 7);
  });

  readonly canMoveArtistsLeft = computed(() => this.artistsCarouselIndex() > 0);

  readonly canMoveArtistsRight = computed(() => {
    const cards = this.recommendedArtists();
    return this.artistsCarouselIndex() + 7 < cards.length;
  });

  constructor() {
    this.bootstrapHome();
  }

  /* ===================== */
  /* INIT */
  /* ===================== */
  private bootstrapHome(): void {
    const user = this.currentUser();
    if (user?.id) {
      this.playlistState.ensureLikedSongsPlaylist(user.id);
    }

    this.refreshListenNowSongs();
    this.refreshRecommendedArtists();
  }

  /* ===================== */
  /* STORAGE */
  /* ===================== */
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

  private persistUserLibrary(items: LibraryItem[]): void {
    localStorage.setItem(this.USER_LIBRARY_KEY, JSON.stringify(items));
    this.userLibrary.set(items);
  }

/* ===================== */
/* TABS */
/* ===================== */
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

  /* ===================== */
  /* CAROUSELS */
  /* ===================== */
  moveAlbumsLeft(): void {
    if (!this.canMoveAlbumsLeft()) return;
    this.albumsCarouselIndex.update(value => Math.max(0, value - 1));
  }

  moveAlbumsRight(): void {
    if (!this.canMoveAlbumsRight()) return;
    this.albumsCarouselIndex.update(value => value + 1);
  }

  moveArtistsLeft(): void {
    if (!this.canMoveArtistsLeft()) return;
    this.artistsCarouselIndex.update(value => Math.max(0, value - 1));
  }

  moveArtistsRight(): void {
    if (!this.canMoveArtistsRight()) return;
    this.artistsCarouselIndex.update(value => value + 1);
  }

  /* ===================== */
  /* RANDOM SECTIONS */
  /* ===================== */
  refreshListenNowSongs(): void {
    const shuffled = this.shuffleArray(this.songsCatalog())
      .slice(0, 4)
      .map(song => song.id);

    this.randomListenSongIds.set(shuffled);
  }

  refreshRecommendedArtists(): void {
    const user = this.currentUser();

    const followedArtistIds = new Set(
      user?.id
        ? this.userLibrary()
            .filter(item => item.userId === user.id && item.itemType === 'ARTIST')
            .map(item => item.itemId)
        : []
    );

    const available = this.artistsCatalog().filter(artist => !followedArtistIds.has(artist.id));
    const shuffled = this.shuffleArray(available)
      .slice(0, 12)
      .map(artist => artist.id);

    this.randomRecommendedArtistIds.set(shuffled);
    this.artistsCarouselIndex.set(0);
  }

  /* ===================== */
  /* PLAYBACK */
  /* ===================== */
  playAlbum(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    const firstSong = this.songsCatalog().find(song => song.albumId === albumId);
    if (!firstSong) return;

    const currentSong = this.playerState.currentSong();

    if (
      currentSong?.albumId === albumId &&
      currentSong.id === firstSong.id &&
      this.playerState.isPlaying()
    ) {
      this.playerState.pause();
      return;
    }

    if (
      currentSong?.albumId === albumId &&
      currentSong.id === firstSong.id &&
      !this.playerState.isPlaying()
    ) {
      this.playerState.resume();
      return;
    }

    this.playerState.playSong(firstSong);
  }

  isAlbumPlaying(albumId: string): boolean {
    const currentSong = this.playerState.currentSong();
    return !!currentSong && currentSong.albumId === albumId && this.playerState.isPlaying();
  }

  playSong(songId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    const storedSong = this.songsCatalog().find(song => song.id === songId);
    if (!storedSong) return;

    if (this.isSongPlaying(songId)) {
      this.playerState.pause();
      return;
    }

    this.playerState.playSong(storedSong);
  }

  isSongPlaying(songId: string): boolean {
    const currentSong = this.playerState.currentSong();
    return !!currentSong && currentSong.id === songId && this.playerState.isPlaying();
  }

  playArtist(artistId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    const songs = this.songsCatalog()
      .filter(song => song.artistId === artistId)
      .sort((a, b) => {
        const diff = (b.playCount ?? 0) - (a.playCount ?? 0);
        if (diff !== 0) return diff;

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    const firstSong = songs[0];
    if (!firstSong) return;

    const currentSong = this.playerState.currentSong();

    if (
      currentSong?.artistId === artistId &&
      currentSong.id === firstSong.id &&
      this.playerState.isPlaying()
    ) {
      this.playerState.pause();
      return;
    }

    if (
      currentSong?.artistId === artistId &&
      currentSong.id === firstSong.id &&
      !this.playerState.isPlaying()
    ) {
      this.playerState.resume();
      return;
    }

    this.playerState.playSong(firstSong);
  }

  isArtistPlaying(artistId: string): boolean {
    const currentSong = this.playerState.currentSong();
    return !!currentSong && currentSong.artistId === artistId && this.playerState.isPlaying();
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

  isAlbumSaved(albumId: string): boolean {
    const user = this.currentUser();
    if (!user?.id || !albumId) return false;

    return this.userLibrary().some(
      item =>
        item.userId === user.id &&
        item.itemType === 'ALBUM' &&
        item.itemId === albumId
    );
  }

  toggleSaveAlbum(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    const user = this.currentUser();
    if (!user?.id || !albumId) return;

    if (this.isAlbumSaved(albumId)) {
      const updated = this.userLibrary().filter(
        item =>
          !(
            item.userId === user.id &&
            item.itemType === 'ALBUM' &&
            item.itemId === albumId
          )
      );

      this.persistUserLibrary(updated);
      this.closeAlbumMenu();
      return;
    }

    const newItem: LibraryItem = {
      id: crypto.randomUUID(),
      userId: user.id,
      itemType: 'ALBUM',
      itemId: albumId,
      addedAt: new Date().toISOString(),
    };

    this.persistUserLibrary([...this.userLibrary(), newItem]);
    this.closeAlbumMenu();
  }

  addAlbumToNewPlaylist(albumId: string): void {
    const user = this.currentUser();
    if (!user?.id || !albumId) return;

    const nextNumber = this.playlistState.getCustomPlaylistsByUser(user.id).length + 1;

    const created = this.playlistState.createPlaylist({
      userId: user.id,
      name: `Mi playlist n.° ${nextNumber}`,
      description: null,
      coverUrl: null,
      visibility: 'PUBLIC',
    });

    const albumSongs = this.songsCatalog().filter(song => song.albumId === albumId);

    albumSongs.forEach(song => {
      this.playlistState.addSongToPlaylist(created.id, song.id);
    });

    const firstSong = albumSongs[0];
    if (firstSong?.coverUrl) {
      this.playlistState.updatePlaylist(created.id, {
        coverUrl: firstSong.coverUrl,
      });
    }

    this.closeAlbumMenu();
  }

  addAlbumToExistingPlaylist(playlistId: string, albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (!playlistId || !albumId) return;

    const albumSongs = this.songsCatalog().filter(song => song.albumId === albumId);

    albumSongs.forEach(song => {
      this.playlistState.addSongToPlaylist(playlistId, song.id);
    });

    const playlist = this.playlistState.playlists().find(item => item.id === playlistId);
    const firstSong = albumSongs[0];

    if (playlist && !playlist.coverUrl && firstSong?.coverUrl) {
      this.playlistState.updatePlaylist(playlistId, {
        coverUrl: firstSong.coverUrl,
      });
    }

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

    if (this.openSongPlaylistSubmenuId() === songId) {
      this.openSongPlaylistSubmenuId.set(null);
      return;
    }

    this.openSongPlaylistSubmenuId.set(songId);
  }

  closeSongMenu(): void {
    this.openSongMenuId.set(null);
    this.openSongPlaylistSubmenuId.set(null);
  }

  isSongLiked(songId: string): boolean {
    const user = this.currentUser();
    if (!user?.id) return false;

    const likedPlaylist = this.playlistState.getLikedSongsPlaylist(user.id)
      ?? this.playlistState.ensureLikedSongsPlaylist(user.id);

    return likedPlaylist.songIds.includes(songId);
  }

  toggleSongLike(songId: string): void {
    const user = this.currentUser();
    if (!user?.id) return;

    if (this.isSongLiked(songId)) {
      this.playlistState.removeSongFromLikedSongs(user.id, songId);
      this.closeSongMenu();
      return;
    }

    this.playlistState.addSongToLikedSongs(user.id, songId);
    this.closeSongMenu();
  }

  addSongToNewPlaylist(songId: string): void {
    const user = this.currentUser();
    if (!user?.id) return;

    const nextNumber = this.playlistState.getCustomPlaylistsByUser(user.id).length + 1;

    const created = this.playlistState.createPlaylist({
      userId: user.id,
      name: `Mi playlist n.° ${nextNumber}`,
      description: null,
      coverUrl: null,
      visibility: 'PUBLIC',
    });

    this.playlistState.addSongToPlaylist(created.id, songId);

    const storedSong = this.songsCatalog().find(song => song.id === songId);
    if (storedSong?.coverUrl) {
      this.playlistState.updatePlaylist(created.id, {
        coverUrl: storedSong.coverUrl,
      });
    }

    this.closeSongMenu();
  }

  addSongToExistingPlaylist(playlistId: string, songId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (!playlistId || !songId) return;

    this.playlistState.addSongToPlaylist(playlistId, songId);

    const playlist = this.playlistState.playlists().find(item => item.id === playlistId);
    const storedSong = this.songsCatalog().find(song => song.id === songId);

    if (playlist && !playlist.coverUrl && storedSong?.coverUrl) {
      this.playlistState.updatePlaylist(playlistId, {
        coverUrl: storedSong.coverUrl,
      });
    }

    this.closeSongMenu();
  }

  /* ===================== */
  /* FOLLOW ARTIST */
  /* ===================== */
  isArtistFollowed(artistId: string): boolean {
    const user = this.currentUser();
    if (!user?.id || !artistId) return false;

    return this.userLibrary().some(
      item =>
        item.userId === user.id &&
        item.itemType === 'ARTIST' &&
        item.itemId === artistId
    );
  }

  followArtistFromRecommended(artistId: string): void {
    const user = this.currentUser();
    if (!user?.id || !artistId) return;

    if (this.isArtistFollowed(artistId)) return;

    const newItem: LibraryItem = {
      id: crypto.randomUUID(),
      userId: user.id,
      itemType: 'ARTIST',
      itemId: artistId,
      addedAt: new Date().toISOString(),
    };

    this.persistUserLibrary([...this.userLibrary(), newItem]);

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

  private shuffleArray<T>(items: T[]): T[] {
    const copy = [...items];

    for (let index = copy.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
    }

    return copy;
  }
}