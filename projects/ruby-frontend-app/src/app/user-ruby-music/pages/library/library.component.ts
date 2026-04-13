import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ArtistResponse, AlbumResponse, SongResponse } from 'lib-ruby-sdks/catalog-service';
import { PlaylistResponse } from 'lib-ruby-sdks/playlist-service';
import { PlaylistCardComponent } from 'lib-ruby-core-ui';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { PlaylistState } from '../../state/playlist.state';
import { PlayerState, PlayerSong } from '../../state/player.state';
import { LibraryState } from '../../state/library.state';
import { InteractionState } from '../../state/interaction.state';

type LibraryFilter = 'TODOS' | 'PLAYLISTS' | 'ARTISTAS' | 'ALBUMES';

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

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule, PlaylistCardComponent],
  templateUrl: './library.component.html',
  styleUrls: ['./library.component.scss'],
})
export class LibraryComponent {
  private readonly authState = inject(AuthState);
  private readonly playlistState = inject(PlaylistState);
  private readonly router = inject(Router);
  private readonly playerState = inject(PlayerState);
  private readonly libraryState = inject(LibraryState);
  private readonly interactionState = inject(InteractionState);

  private readonly defaultAvatar = '/assets/icons/avatar-placeholder.png';
  private readonly defaultPlaylistCover = '/assets/icons/playlist-cover-placeholder.png';

  readonly currentUser = this.authState.currentUser;
  readonly loading = this.libraryState.loading;

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

  readonly displayAvatarUrl = computed(() => {
    return this.currentUser()?.avatarUrl || this.defaultAvatar;
  });

  readonly likedSongsPlaylist = computed<LibraryPlaylistCard | null>(() => {
    const user = this.currentUser();
    if (!user) return null;

    const liked = this.playlistState.getLikedSongsPlaylist(user.id);
    if (!liked) return null;

    const term = this.librarySearch().trim().toLowerCase();
    const count = liked.songCount ?? 0;

    const likedCard: LibraryPlaylistCard = {
      id: liked.id ?? '',
      title: liked.name ?? 'Canciones que te gustan',
      coverUrl: liked.coverUrl ?? null,
      subtitle: `Playlist · ${count} canción${count === 1 ? '' : 'es'}`,
      songsCount: count,
      isLikedSongs: true,
    };

    if (!term) return likedCard;
    return `${likedCard.title} ${likedCard.subtitle}`.toLowerCase().includes(term) ? likedCard : null;
  });

  readonly customPlaylists = computed<LibraryPlaylistCard[]>(() => {
    const user = this.currentUser();
    if (!user) return [];

    const term = this.librarySearch().trim().toLowerCase();

    const playlists = this.playlistState
      .getCustomPlaylistsByUser(user.id)
      .filter((p: PlaylistResponse) => (p.name ?? '').trim().length > 0)
      .map((p: PlaylistResponse) => ({
        id: p.id ?? '',
        title: p.name ?? '',
        coverUrl: p.coverUrl ?? null,
        subtitle: `Playlist · ${user.name}`,
        songsCount: p.songCount ?? 0,
        isLikedSongs: false,
      }));

    if (!term) return playlists;
    return playlists.filter(p =>
      `${p.title} ${p.subtitle}`.toLowerCase().includes(term)
    );
  });

  readonly filteredArtists = computed<LibraryArtistCard[]>(() => {
    const user = this.currentUser();
    if (!user?.id) return [];

    const term = this.librarySearch().trim().toLowerCase();
    const artistIds = this.interactionState.libraryArtistIds();

    const artists = this.libraryState
      .artists()
      .filter((a: ArtistResponse) => artistIds.includes(a.id ?? ''))
      .map((a: ArtistResponse) => ({
        id: a.id ?? '',
        name: a.name ?? '',
        photoUrl: a.photoUrl || this.defaultAvatar,
        typeLabel: 'Artista',
      }));

    if (!term) return artists;
    return artists.filter(a =>
      `${a.name} ${a.typeLabel}`.toLowerCase().includes(term)
    );
  });

  readonly filteredAlbums = computed<LibraryAlbumCard[]>(() => {
    const user = this.currentUser();
    if (!user?.id) return [];

    const term = this.librarySearch().trim().toLowerCase();
    const albumIds = this.interactionState.libraryAlbumIds();

    const albums = this.libraryState
      .albums()
      .filter((a: AlbumResponse) => albumIds.includes(a.id ?? ''))
      .map((album: AlbumResponse) => {
      const artist = this.libraryState.artists().find((a: ArtistResponse) => a.id === album.artist?.id);
      return {
        id: album.id ?? '',
        title: album.title ?? '',
        coverUrl: album.coverUrl || this.defaultPlaylistCover,
        subtitle: `Álbum · ${artist?.name ?? 'Artista desconocido'}`,
        };
      });

    if (!term) return albums;
    return albums.filter(a =>
      `${a.title} ${a.subtitle}`.toLowerCase().includes(term)
    );
  });

  readonly hasLikedSongsCard = computed(() => !!this.likedSongsPlaylist());
  readonly hasArtists = computed(() => this.filteredArtists().length > 0);
  readonly hasAlbums = computed(() => this.filteredAlbums().length > 0);
  readonly hasCustomPlaylists = computed(() => this.customPlaylists().length > 0);
  readonly hasPlaylists = computed(() => this.hasLikedSongsCard() || this.hasCustomPlaylists());
  readonly hasAnyLibraryContent = computed(() => this.hasPlaylists() || this.hasArtists() || this.hasAlbums());

  readonly visibleFilters = computed<LibraryFilter[]>(() => {
    const filters: LibraryFilter[] = ['TODOS', 'PLAYLISTS'];
    if (this.hasArtists()) filters.push('ARTISTAS');
    if (this.hasAlbums()) filters.push('ALBUMES');
    return filters;
  });

  readonly showArtistsColumn = computed(() => {
    const f = this.activeFilter();
    return f === 'TODOS' || f === 'ARTISTAS';
  });

  readonly showPlaylistsColumn = computed(() => {
    const f = this.activeFilter();
    return f === 'TODOS' || f === 'PLAYLISTS';
  });

  readonly showAlbumsColumn = computed(() => {
    const f = this.activeFilter();
    return f === 'TODOS' || f === 'ALBUMES';
  });

  readonly libraryGradient = computed(() => {
    return 'linear-gradient(180deg, #777777 2%, #4e4d4d 12%, #3e3535 34%, #181818 66%, #0c0c0c 96%)';
  });

  readonly topArtists = computed<ArtistResponse[]>(() => {
    const all = this.libraryState.artists();
    const top = all.filter((a: ArtistResponse) => a.isTop).slice(0, 3);
    if (top.length === 3) return top;
    const usedIds = new Set(top.map((a: ArtistResponse) => a.id));
    const rest = all.filter((a: ArtistResponse) => !usedIds.has(a.id)).slice(0, 3 - top.length);
    return [...top, ...rest];
  });

  readonly artistSuggestions = computed<ArtistResponse[]>(() => {
    const query = this.artistModalSearch().trim().toLowerCase();
    const topIds = new Set(this.topArtists().map((a: ArtistResponse) => a.id));
    let result = this.libraryState.artists().filter((a: ArtistResponse) => !topIds.has(a.id));
    if (query) {
      result = result.filter((a: ArtistResponse) => (a.name ?? '').toLowerCase().includes(query));
    }
    return result.slice(0, 9);
  });

  readonly topAlbums = computed<AlbumResponse[]>(() => {
    return this.libraryState.albums().slice(0, 3);
  });

  readonly albumSuggestions = computed<AlbumResponse[]>(() => {
    const query = this.albumModalSearch().trim().toLowerCase();
    const topIds = new Set(this.topAlbums().map((a: AlbumResponse) => a.id));
    let result = this.libraryState.albums().filter((a: AlbumResponse) => !topIds.has(a.id));
    if (query) {
      result = result.filter((a: AlbumResponse) => (a.title ?? '').toLowerCase().includes(query));
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
    this.libraryState.loadTopArtists();
    this.libraryState.loadNewReleases();
    this.libraryState.loadRecentSongs();
    this.interactionState.loadLibraryAlbums();
    this.interactionState.loadLibraryArtists();
    this.playlistState.loadPlaylists();
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
    if (!this.isSearchOpen()) this.librarySearch.set('');
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

    this.playlistState.createPlaylist(
      { name: `Mi playlist n.° ${nextNumber}`, description: null, isPublic: true },
      (created) => {
        this.activeFilter.set('PLAYLISTS');
        this.isCreateMenuOpen.set(false);
        this.router.navigate(['/user/playlist', created.id]);
      }
    );
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
    this.selectedArtistIds.set([...this.interactionState.libraryArtistIds()]);
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
      this.selectedArtistIds.set(this.selectedArtistIds().filter(id => id !== artistId));
      return;
    }
    this.selectedArtistIds.set([...this.selectedArtistIds(), artistId]);
  }

  saveSelectedArtists(): void {
    const current = this.interactionState.libraryArtistIds();
    const selected = this.selectedArtistIds();

    current.filter(id => !selected.includes(id))
      .forEach(id => this.interactionState.removeArtistFromLibrary(id));

    selected.filter(id => !current.includes(id))
      .forEach(id => this.interactionState.addArtistToLibrary(id));

    this.closeArtistsModal();
  }

  /* ===================== */
  /* ALBUM MODAL */
  /* ===================== */
  openAlbumsModal(): void {
    const user = this.currentUser();
    if (!user?.id) return;
    this.selectedAlbumIds.set([...this.interactionState.libraryAlbumIds()]);
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
      this.selectedAlbumIds.set(this.selectedAlbumIds().filter(id => id !== albumId));
      return;
    }
    this.selectedAlbumIds.set([...this.selectedAlbumIds(), albumId]);
  }

  getAlbumArtistName(album: AlbumResponse): string {
    return this.libraryState.artists().find((a: ArtistResponse) => a.id === album.artist?.id)?.name
      ?? 'Artista desconocido';
  }

  saveSelectedAlbums(): void {
    const current = this.interactionState.libraryAlbumIds();
    const selected = this.selectedAlbumIds();

    current.filter(id => !selected.includes(id))
      .forEach(id => this.interactionState.removeAlbumFromLibrary(id));

    selected.filter(id => !current.includes(id))
      .forEach(id => this.interactionState.addAlbumToLibrary(id));

    this.closeAlbumsModal();
  }

  /* ===================== */
  /* PLAY FROM LIBRARY */
  /* ===================== */
  playAlbumFromLibrary(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!albumId) return;

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

  playArtistFromLibrary(artistId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!artistId) return;

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

  playPlaylistFromLibrary(playlistId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!playlistId) return;

    const playlist = this.playlistState.getPlaylistById(playlistId);
    if (!playlist || (playlist.songCount ?? 0) === 0) return;

    const current = this.playerState.currentSong();
    const loadedIds = this.playlistState.getSongIdsForCurrentPlaylist();

    if (current && loadedIds.includes(current.id) && this.playerState.isPlaying()) {
      this.playerState.pause(); return;
    }
    if (current && loadedIds.includes(current.id) && !this.playerState.isPlaying()) {
      this.playerState.resume(); return;
    }

    // Navigate to detail page to load and play songs
    this.router.navigate(['/user/playlist', playlistId]);
  }

  isPlaylistPlaying(playlistId: string): boolean {
    const current = this.playerState.currentSong();
    const loadedIds = this.playlistState.getSongIdsForCurrentPlaylist();
    if (!current) return false;
    const playlist = this.playlistState.getPlaylistById(playlistId);
    if (!playlist) return false;
    return loadedIds.includes(current.id) && this.playerState.isPlaying();
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

  /* ===================== */
  /* HELPERS */
  /* ===================== */
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
}
