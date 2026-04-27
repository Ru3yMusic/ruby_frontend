import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ArtistResponse, AlbumResponse } from 'lib-ruby-sdks/catalog-service';
import { PlaylistResponse } from 'lib-ruby-sdks/playlist-service';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { PlaylistState } from '../../state/playlist.state';
import { PlayerState } from '../../state/player.state';
import { LibraryState } from '../../state/library.state';
import { InteractionState } from '../../state/interaction.state';
import { SavedPlaylistsState } from '../../state/saved-playlists.state';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';

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
  imports: [CommonModule, ImgFallbackDirective],
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
  private readonly savedPlaylistsState = inject(SavedPlaylistsState);

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

    const own: LibraryPlaylistCard[] = this.playlistState
      .getCustomPlaylistsByUser(user.id)
      .filter((p: PlaylistResponse) => (p.name ?? '').trim().length > 0)
      .map((p: PlaylistResponse) => ({
        id: p.id ?? '',
        title: p.name ?? '',
        coverUrl: p.coverUrl ?? this.defaultPlaylistCover,
        subtitle: `Playlist · ${user.name}`,
        songsCount: p.songCount ?? 0,
        isLikedSongs: false,
      }));

    // Playlists guardadas de OTROS usuarios. Aparecen mezcladas con las
    // propias en la misma sección, con el mismo layout. Las restricciones
    // (no editar, no agregar canciones, no borrar) ya viven en
    // playlist-detail vía isOwner(). Subtitle distinto para no mentir
    // sobre la autoría sin romper la simetría visual.
    const saved: LibraryPlaylistCard[] = this.savedPlaylistsState
      .savedList()
      .filter((p: PlaylistResponse) => (p.name ?? '').trim().length > 0)
      .map((p: PlaylistResponse) => ({
        id: p.id ?? '',
        title: p.name ?? '',
        coverUrl: p.coverUrl ?? this.defaultPlaylistCover,
        subtitle: 'Playlist guardada',
        songsCount: p.songCount ?? 0,
        isLikedSongs: false,
      }));

    const playlists = [...own, ...saved];

    if (!term) return playlists;
    return playlists.filter(p =>
      `${p.title} ${p.subtitle}`.toLowerCase().includes(term)
    );
  });

  readonly filteredArtists = computed<LibraryArtistCard[]>(() => {
    const user = this.currentUser();
    if (!user?.id) return [];

    const term = this.librarySearch().trim().toLowerCase();
    const artistIds = this.interactionState.allFollowedArtistIds();

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
    this.libraryState.loadArtists();
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
    this.selectedArtistIds.set([...this.interactionState.allFollowedArtistIds()]);
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
    const current = this.interactionState.allFollowedArtistIds();
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

    // Fetch the album's full tracklist from catalog-service. The global
    // `libraryState.songs()` only holds "recent" songs, so filtering it by
    // albumId often returned a subset (often 1 track) → hasQueue() was false
    // and footer prev/next stayed disabled. This mirrors how album-detail
    // loads its songs.
    // Raw SongResponse[] — PlayerState.normalizeInputSong maps nested
    // artist/album/genres into flat PlayerSong fields, no pre-mapping needed.
    this.libraryState.getAlbumSongs(albumId).subscribe(albumSongs => {
      if (albumSongs.length === 0) return;
      const current = this.playerState.currentSong();

      if (current && albumSongs.some(s => s.id === current.id) && this.playerState.isPlaying()) {
        this.playerState.pause(); return;
      }
      if (current && albumSongs.some(s => s.id === current.id) && !this.playerState.isPlaying()) {
        this.playerState.resume(); return;
      }
      this.playerState.playQueue(albumSongs, 0);
    });
  }

  isAlbumPlaying(albumId: string): boolean {
    const current = this.playerState.currentSong();
    return !!current && current.albumId === albumId && this.playerState.isPlaying();
  }

  playArtistFromLibrary(artistId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!artistId) return;

    const artistSongs = this.libraryState.songs()
      .filter(s => s.artist?.id === artistId)
      .sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0));

    if (artistSongs.length === 0) return;
    const current = this.playerState.currentSong();

    if (current && artistSongs.some(s => s.id === current.id) && this.playerState.isPlaying()) {
      this.playerState.pause(); return;
    }
    if (current && artistSongs.some(s => s.id === current.id) && !this.playerState.isPlaying()) {
      this.playerState.resume(); return;
    }
    this.playerState.playQueue(artistSongs, 0);
  }

  isArtistPlaying(artistId: string): boolean {
    const current = this.playerState.currentSong();
    return !!current && current.artistId === artistId && this.playerState.isPlaying();
  }

  /**
   * Starts a playlist from a Library card without navigating.
   *   - If this playlist is already the current one playing → pause.
   *   - If it's the current one but paused → resume.
   *   - Otherwise load its songs, fetch the first track, and play it.
   * The old version fell through to router.navigate when its songs weren't
   * preloaded, which matched no other library card's behaviour. Albums and
   * artists never navigate on play.
   */
  playPlaylistFromLibrary(playlistId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!playlistId) return;

    const playlist = this.playlistState.getPlaylistById(playlistId);
    if (!playlist || (playlist.songCount ?? 0) === 0) return;

    // Already the currently loaded playlist → simple toggle.
    if (this.playlistState.currentPlaylistId() === playlistId) {
      const current = this.playerState.currentSong();
      const loadedIds = this.playlistState.getSongIdsForCurrentPlaylist();
      if (current && loadedIds.includes(current.id)) {
        if (this.playerState.isPlaying()) {
          this.playerState.pause();
        } else {
          this.playerState.resume();
        }
        return;
      }
    }

    // Otherwise load it and play the whole playlist as a queue so footer
    // next/previous can move through its songs.
    this.playlistState.loadPlaylistSongs(playlistId, (songs) => {
      const orderedIds = [...songs]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map(s => s.songId)
        .filter((id): id is string => !!id);
      if (orderedIds.length === 0) return;
      // Resolve full SongResponse for every id — libraryState.loadSongById
      // returns cached entries synchronously via of() when available so this
      // typically resolves immediately and keeps the playback snappy.
      forkJoin(orderedIds.map(id => this.libraryState.loadSongById(id))).subscribe(resolved => {
        const queue = resolved.filter(Boolean) as any[];
        if (queue.length === 0) return;
        this.playerState.playQueue(queue as any, 0);
      });
    });
  }

  /**
   * Only true when the CLICKED playlist is the one currently loaded AND the
   * player is actually running it. Tracks with the same song id in a sibling
   * playlist no longer trigger a false "playing" indicator on every card.
   */
  isPlaylistPlaying(playlistId: string): boolean {
    if (this.playlistState.currentPlaylistId() !== playlistId) return false;
    const current = this.playerState.currentSong();
    if (!current || !this.playerState.isPlaying()) return false;
    return this.playlistState.getSongIdsForCurrentPlaylist().includes(current.id);
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
