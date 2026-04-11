import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { Playlist } from '../../models/playlist.model';
import { PlaylistState } from '../../state/playlist.state';
import { PlayerState } from '../../state/player.state';

type LibraryFilter = 'TODOS' | 'PLAYLISTS' | 'ARTISTAS' | 'ALBUMES';
type LibraryItemType = 'ARTIST' | 'ALBUM';

interface LibraryArtistCard {
  id: string;
  name: string;
  photoUrl: string;
  typeLabel: string;
}

interface LibraryAlbumCard {
  id: string;
  title: string;
  coverUrl: string;
  subtitle: string;
}

interface LibraryPlaylistCard {
  id: string;
  title: string;
  coverUrl: string | null;
  subtitle: string;
  songsCount: number;
  isLikedSongs: boolean;
}

interface LibraryItem {
  id: string;
  userId: string;
  itemType: LibraryItemType;
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

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './library.component.html',
  styleUrls: ['./library.component.scss'],
})
export class LibraryComponent {
  private readonly authState = inject(AuthState);
  private readonly playlistState = inject(PlaylistState);
  private readonly router = inject(Router);
  private readonly playerState = inject(PlayerState);

  private readonly USER_LIBRARY_KEY = 'ruby_user_library';
  private readonly ARTISTS_KEY = 'ruby_artists';
  private readonly ALBUMS_KEY = 'ruby_albums';
  private readonly SONGS_KEY = 'ruby_songs';

  private readonly defaultTopColor = '#3e3535';
  private readonly defaultAvatar = '/assets/icons/avatar-placeholder.png';
  private readonly defaultPlaylistCover = '/assets/icons/playlist-cover-placeholder.png';

  readonly currentUser = this.authState.currentUser;

  readonly isCreateMenuOpen = signal(false);
  readonly isSearchOpen = signal(false);
  readonly librarySearch = signal('');
  readonly activeFilter = signal<LibraryFilter>('TODOS');

  readonly isArtistsModalOpen = signal(false);
  readonly isAlbumsModalOpen = signal(false);

  readonly artistModalSearch = signal('');
  readonly albumModalSearch = signal('');

  readonly selectedArtistIds = signal<string[]>([]);
  readonly selectedAlbumIds = signal<string[]>([]);

  readonly userLibrary = signal<LibraryItem[]>(this.loadUserLibrary());
  readonly artistsCatalog = signal<StoredArtist[]>(this.loadStorageArray<StoredArtist>(this.ARTISTS_KEY));
  readonly albumsCatalog = signal<StoredAlbum[]>(this.loadStorageArray<StoredAlbum>(this.ALBUMS_KEY));
  readonly songsCatalog = signal<StoredSong[]>(this.loadStorageArray<StoredSong>(this.SONGS_KEY));

  readonly displayAvatarUrl = computed(() => {
    return this.currentUser()?.avatarUrl || this.defaultAvatar;
  });

  readonly likedSongsPlaylist = computed<LibraryPlaylistCard | null>(() => {
    const user = this.currentUser();
    if (!user) return null;

    const liked = this.playlistState.ensureLikedSongsPlaylist(user.id);
    const term = this.librarySearch().trim().toLowerCase();

    const likedCard: LibraryPlaylistCard = {
      id: liked.id,
      title: liked.name,
      coverUrl: liked.coverUrl,
      subtitle: `Playlist · ${liked.songIds.length} canción${liked.songIds.length === 1 ? '' : 'es'}`,
      songsCount: liked.songIds.length,
      isLikedSongs: true,
    };

    if (!term) return likedCard;

    const matches = `${likedCard.title} ${likedCard.subtitle}`.toLowerCase().includes(term);
    return matches ? likedCard : null;
  });

  readonly customPlaylists = computed<LibraryPlaylistCard[]>(() => {
    const user = this.currentUser();
    if (!user) return [];

    const term = this.librarySearch().trim().toLowerCase();

    const playlists = this.playlistState
      .getCustomPlaylistsByUser(user.id)
      .filter((playlist: Playlist) => playlist.name.trim().length > 0)
      .map((playlist: Playlist) => ({
        id: playlist.id,
        title: playlist.name,
        coverUrl: playlist.coverUrl,
        subtitle: `Playlist · ${user.name}`,
        songsCount: playlist.songIds.length,
        isLikedSongs: false,
      }));

    if (!term) return playlists;

    return playlists.filter(playlist =>
      `${playlist.title} ${playlist.subtitle}`.toLowerCase().includes(term)
    );
  });

  readonly filteredArtists = computed<LibraryArtistCard[]>(() => {
    const user = this.currentUser();
    if (!user?.id) return [];

    const term = this.librarySearch().trim().toLowerCase();

    const artistIds = this.userLibrary()
      .filter(item => item.userId === user.id && item.itemType === 'ARTIST')
      .map(item => item.itemId);

    const artists = this.artistsCatalog()
      .filter(artist => artistIds.includes(artist.id))
      .map((artist) => ({
        id: artist.id,
        name: artist.name,
        photoUrl: artist.photoUrl || this.defaultAvatar,
        typeLabel: 'Artista',
      }));

    if (!term) return artists;

    return artists.filter(artist =>
      `${artist.name} ${artist.typeLabel}`.toLowerCase().includes(term)
    );
  });

  readonly filteredAlbums = computed<LibraryAlbumCard[]>(() => {
    const user = this.currentUser();
    if (!user?.id) return [];

    const term = this.librarySearch().trim().toLowerCase();

    const albumIds = this.userLibrary()
      .filter(item => item.userId === user.id && item.itemType === 'ALBUM')
      .map(item => item.itemId);

    const albums = this.albumsCatalog()
      .filter(album => albumIds.includes(album.id))
      .map((album) => {
        const artist = this.artistsCatalog().find(a => a.id === album.artistId);

        return {
          id: album.id,
          title: album.title,
          coverUrl: album.coverUrl || this.defaultPlaylistCover,
          subtitle: `Álbum · ${artist?.name ?? 'Artista desconocido'}`,
        };
      });

    if (!term) return albums;

    return albums.filter(album =>
      `${album.title} ${album.subtitle}`.toLowerCase().includes(term)
    );
  });

  readonly hasLikedSongsCard = computed(() => !!this.likedSongsPlaylist());
  readonly hasArtists = computed(() => this.filteredArtists().length > 0);
  readonly hasAlbums = computed(() => this.filteredAlbums().length > 0);
  readonly hasCustomPlaylists = computed(() => this.customPlaylists().length > 0);

  readonly hasPlaylists = computed(() => {
    return this.hasLikedSongsCard() || this.hasCustomPlaylists();
  });

  readonly hasAnyLibraryContent = computed(() => {
    return this.hasPlaylists() || this.hasArtists() || this.hasAlbums();
  });

  readonly visibleFilters = computed<LibraryFilter[]>(() => {
    const filters: LibraryFilter[] = ['TODOS', 'PLAYLISTS'];

    if (this.hasArtists()) {
      filters.push('ARTISTAS');
    }

    if (this.hasAlbums()) {
      filters.push('ALBUMES');
    }

    return filters;
  });

  readonly showArtistsColumn = computed(() => {
    const filter = this.activeFilter();
    return filter === 'TODOS' || filter === 'ARTISTAS';
  });

  readonly showPlaylistsColumn = computed(() => {
    const filter = this.activeFilter();
    return filter === 'TODOS' || filter === 'PLAYLISTS';
  });

  readonly showAlbumsColumn = computed(() => {
    const filter = this.activeFilter();
    return filter === 'TODOS' || filter === 'ALBUMES';
  });

  readonly dynamicMiddleColor = computed(() => {
    return this.defaultTopColor;
  });

  readonly libraryGradient = computed(() => {
    const middle = this.dynamicMiddleColor();
    return `linear-gradient(180deg, #777777 2%, #4e4d4d 12%, ${middle} 34%, #181818 66%, #0c0c0c 96%)`;
  });

  readonly topArtists = computed<StoredArtist[]>(() => {
    const all = this.artistsCatalog();
    const top = all.filter(artist => artist.isTop).slice(0, 3);

    if (top.length === 3) return top;

    const usedIds = new Set(top.map(artist => artist.id));
    const rest = all.filter(artist => !usedIds.has(artist.id)).slice(0, 3 - top.length);

    return [...top, ...rest];
  });

  readonly artistSuggestions = computed<StoredArtist[]>(() => {
    const query = this.artistModalSearch().trim().toLowerCase();
    const topIds = new Set(this.topArtists().map(artist => artist.id));

    let result = this.artistsCatalog().filter(artist => !topIds.has(artist.id));

    if (query) {
      result = result.filter(artist =>
        artist.name.toLowerCase().includes(query)
      );
    }

    return result.slice(0, 9);
  });

  readonly topAlbums = computed<StoredAlbum[]>(() => {
    return this.albumsCatalog().slice(0, 3);
  });

  readonly albumSuggestions = computed<StoredAlbum[]>(() => {
    const query = this.albumModalSearch().trim().toLowerCase();
    const topIds = new Set(this.topAlbums().map(album => album.id));

    let result = this.albumsCatalog().filter(album => !topIds.has(album.id));

    if (query) {
      result = result.filter(album =>
        album.title.toLowerCase().includes(query)
      );
    }

    return result.slice(0, 9);
  });

  constructor() {
    this.bootstrapLibrary();
  }

  /* ===================== */
  /* INIT */
  /* ===================== */
  private bootstrapLibrary(): void {
    const user = this.currentUser();
    if (!user?.id) return;

    this.playlistState.ensureLikedSongsPlaylist(user.id);
  }

  /* ===================== */
  /* STORAGE */
  /* ===================== */
  private loadUserLibrary(): LibraryItem[] {
    try {
      const raw = localStorage.getItem(this.USER_LIBRARY_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed as LibraryItem[] : [];
    } catch {
      return [];
    }
  }

  private loadStorageArray<T>(storageKey: string): T[] {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed as T[] : [];
    } catch {
      return [];
    }
  }

  private persistUserLibrary(items: LibraryItem[]): void {
    localStorage.setItem(this.USER_LIBRARY_KEY, JSON.stringify(items));
    this.userLibrary.set(items);
  }

  /* ===================== */
  /* UI */
  /* ===================== */
  toggleCreateMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isCreateMenuOpen.set(!this.isCreateMenuOpen());
  }

  closeCreateMenu(): void {
    this.isCreateMenuOpen.set(false);
  }

  toggleSearch(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isSearchOpen.set(!this.isSearchOpen());

    if (!this.isSearchOpen()) {
      this.librarySearch.set('');
    }
  }

  closeSearch(): void {
    this.isSearchOpen.set(false);
    this.librarySearch.set('');
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.librarySearch.set(input.value);
  }

  setFilter(filter: LibraryFilter): void {
    this.activeFilter.set(filter);
  }

  isFilterActive(filter: LibraryFilter): boolean {
    return this.activeFilter() === filter;
  }

  getFilterLabel(filter: LibraryFilter): string {
    if (filter === 'TODOS') return 'Todos';
    if (filter === 'PLAYLISTS') return 'Playlists';
    if (filter === 'ARTISTAS') return 'Artistas';
    return 'Álbumes';
  }

  /* ===================== */
  /* PLAYLISTS */
  /* ===================== */
  createPlaylist(): void {
    const user = this.currentUser();
    if (!user?.id) return;

    const nextNumber = this.customPlaylists().length + 1;

    const created = this.playlistState.createPlaylist({
      userId: user.id,
      name: `Mi playlist n.° ${nextNumber}`,
      description: null,
      coverUrl: null,
      visibility: 'PUBLIC',
    });

    this.activeFilter.set('PLAYLISTS');
    this.isCreateMenuOpen.set(false);

    this.router.navigate(['/user/playlist', created.id]);
  }

  goToPlaylistDetail(playlistId: string): void {
    if (!playlistId) return;

    this.isCreateMenuOpen.set(false);
    this.router.navigate(['/user/playlist', playlistId]);
  }

  goToLikedSongs(): void {
    const liked = this.likedSongsPlaylist();
    if (!liked?.id) return;

    this.isCreateMenuOpen.set(false);
    this.router.navigate(['/user/playlist', liked.id]);
  }

  /* ===================== */
  /* ARTIST MODAL */
  /* ===================== */
  openArtistsModal(): void {
    const user = this.currentUser();
    if (!user?.id) return;

    const currentIds = this.userLibrary()
      .filter(item => item.userId === user.id && item.itemType === 'ARTIST')
      .map(item => item.itemId);

    this.selectedArtistIds.set(currentIds);
    this.artistModalSearch.set('');
    this.isArtistsModalOpen.set(true);
  }

  closeArtistsModal(): void {
    this.isArtistsModalOpen.set(false);
    this.artistModalSearch.set('');
  }

  onArtistModalSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.artistModalSearch.set(input.value);
  }

  isArtistSelected(artistId: string): boolean {
    return this.selectedArtistIds().includes(artistId);
  }

  toggleArtistSelection(artistId: string): void {
    if (this.isArtistSelected(artistId)) {
      this.selectedArtistIds.set(
        this.selectedArtistIds().filter(id => id !== artistId)
      );
      return;
    }

    this.selectedArtistIds.set([...this.selectedArtistIds(), artistId]);
  }

  saveSelectedArtists(): void {
    const user = this.currentUser();
    if (!user?.id) return;

    const otherItems = this.userLibrary().filter(
      item => !(item.userId === user.id && item.itemType === 'ARTIST')
    );

    const newArtistItems: LibraryItem[] = this.selectedArtistIds().map(artistId => ({
      id: crypto.randomUUID(),
      userId: user.id,
      itemType: 'ARTIST',
      itemId: artistId,
      addedAt: new Date().toISOString(),
    }));

    this.persistUserLibrary([...otherItems, ...newArtistItems]);
    this.closeArtistsModal();
  }

  /* ===================== */
  /* ALBUM MODAL */
  /* ===================== */
  openAlbumsModal(): void {
    const user = this.currentUser();
    if (!user?.id) return;

    const currentIds = this.userLibrary()
      .filter(item => item.userId === user.id && item.itemType === 'ALBUM')
      .map(item => item.itemId);

    this.selectedAlbumIds.set(currentIds);
    this.albumModalSearch.set('');
    this.isAlbumsModalOpen.set(true);
  }

  closeAlbumsModal(): void {
    this.isAlbumsModalOpen.set(false);
    this.albumModalSearch.set('');
  }

  onAlbumModalSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.albumModalSearch.set(input.value);
  }

  isAlbumSelected(albumId: string): boolean {
    return this.selectedAlbumIds().includes(albumId);
  }

  toggleAlbumSelection(albumId: string): void {
    if (this.isAlbumSelected(albumId)) {
      this.selectedAlbumIds.set(
        this.selectedAlbumIds().filter(id => id !== albumId)
      );
      return;
    }

    this.selectedAlbumIds.set([...this.selectedAlbumIds(), albumId]);
  }

  getAlbumArtistName(album: StoredAlbum): string {
    return this.artistsCatalog().find(artist => artist.id === album.artistId)?.name ?? 'Artista desconocido';
  }

  saveSelectedAlbums(): void {
    const user = this.currentUser();
    if (!user?.id) return;

    const otherItems = this.userLibrary().filter(
      item => !(item.userId === user.id && item.itemType === 'ALBUM')
    );

    const newAlbumItems: LibraryItem[] = this.selectedAlbumIds().map(albumId => ({
      id: crypto.randomUUID(),
      userId: user.id,
      itemType: 'ALBUM',
      itemId: albumId,
      addedAt: new Date().toISOString(),
    }));

    this.persistUserLibrary([...otherItems, ...newAlbumItems]);
    this.closeAlbumsModal();
  }

  /* ===================== */
  /* PLAY FROM LIBRARY */
  /* ===================== */
  playAlbumFromLibrary(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (!albumId) return;

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

  playArtistFromLibrary(artistId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (!artistId) return;

    const artistSongs = this.songsCatalog()
      .filter(song => song.artistId === artistId)
      .sort((a, b) => {
        const diff = (b.playCount ?? 0) - (a.playCount ?? 0);
        if (diff !== 0) return diff;

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    const firstSong = artistSongs[0];
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


playPlaylistFromLibrary(playlistId: string, event?: MouseEvent): void {
  event?.stopPropagation();

  if (!playlistId) return;

  const playlist = this.playlistState.playlists().find(item => item.id === playlistId);
  if (!playlist || playlist.songIds.length === 0) return;

  const firstSongId = playlist.songIds[0];
  const firstSong = this.songsCatalog().find(song => song.id === firstSongId);
  if (!firstSong) return;

  const currentSong = this.playerState.currentSong();

  if (
    currentSong &&
    playlist.songIds.includes(currentSong.id) &&
    this.playerState.isPlaying()
  ) {
    this.playerState.pause();
    return;
  }

  if (
    currentSong &&
    playlist.songIds.includes(currentSong.id) &&
    !this.playerState.isPlaying()
  ) {
    this.playerState.resume();
    return;
  }

  this.playerState.playSong(firstSong);
}

isPlaylistPlaying(playlistId: string): boolean {
  const playlist = this.playlistState.playlists().find(item => item.id === playlistId);
  const currentSong = this.playerState.currentSong();

  if (!playlist || !currentSong) return false;

  return playlist.songIds.includes(currentSong.id) && this.playerState.isPlaying();
}





  /* ===================== */
  /* TOP ACTIONS */
  /* ===================== */
  addAlbums(): void {
    this.isCreateMenuOpen.set(false);
    this.openAlbumsModal();
  }

  addArtists(): void {
    this.isCreateMenuOpen.set(false);
    this.openArtistsModal();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeCreateMenu();
  }

  goToAlbumDetail(albumId: string): void {
    if (!albumId) return;

    this.isCreateMenuOpen.set(false);
    this.router.navigate(['/user/album', albumId]);
  }

  goToArtistDetail(artistId: string): void {
    if (!artistId) return;

    this.isCreateMenuOpen.set(false);
    this.router.navigate(['/user/artist', artistId]);
  }
}