import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PlaylistResponse } from 'lib-ruby-sdks/playlist-service';
import { UsersApi } from 'lib-ruby-sdks/auth-service';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { LibraryState } from '../../state/library.state';
import { PlaylistState } from '../../state/playlist.state';
import { PlayerState } from '../../state/player.state';
import { InteractionState } from '../../state/interaction.state';
import { SavedPlaylistsState } from '../../state/saved-playlists.state';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';

type AddSongsTab = 'SUGGESTIONS' | 'LIKED';

interface PlaylistSongRow {
  id: string;
  songId: string;
  title: string;
  artistName: string;
  albumTitle: string;
  coverUrl: string;
  durationLabel: string;
  addedAgoLabel: string;
}

interface RecommendedSongRow {
  id: string;
  songId: string;
  title: string;
  artistName: string;
  albumTitle: string;
  coverUrl: string;
}

interface AddSongsRow {
  id: string;
  songId: string;
  title: string;
  artistName: string;
  coverUrl: string;
}

@Component({
  selector: 'app-playlist-detail',
  standalone: true,
  imports: [CommonModule, ImgFallbackDirective],
  templateUrl: './playlist-detail.component.html',
  styleUrls: ['./playlist-detail.component.scss'],
})
export class PlaylistDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authState = inject(AuthState);
  private readonly playlistState = inject(PlaylistState);
  private readonly playerState = inject(PlayerState);
  private readonly libraryState = inject(LibraryState);
  private readonly interactionState = inject(InteractionState);
  private readonly savedPlaylistsState = inject(SavedPlaylistsState);
  private readonly usersApi = inject(UsersApi);

  /**
   * Datos del creador de la playlist cuando el current user NO es el dueño.
   * Para playlists propias, displayOwnerName usa `currentUser.name` directo;
   * para ajenas hidrata estos signals via auth-service.
   */
  private readonly _playlistOwnerName = signal<string | null>(null);
  private readonly _playlistOwnerAvatarUrl = signal<string | null>(null);
  private fetchedOwnerForPlaylistId: string | null = null;

  private readonly defaultTopColor = '#4b4b4b';
  private readonly defaultPlaylistCover = '/assets/icons/playlist-cover-placeholder.png';
  private readonly likedSongsCover = '/assets/icons/library-liked-songs-cover.png';

  readonly currentUser = this.authState.currentUser;

  readonly playlistId = signal(this.route.snapshot.paramMap.get('id') ?? '');

  readonly isMoreMenuOpen = signal(false);
  readonly isEditCoverModalOpen = signal(false);
  readonly isAddSongsModalOpen = signal(false);
  /**
   * Playlist-detail's shuffle button and the footer's shuffle button share
   * the same state — flipping either affects playback everywhere. We just
   * delegate to PlayerState so there's a single source of truth.
   */
  readonly isShuffleEnabled = this.playerState.isShuffle;

  readonly editPlaylistName = signal('');
  readonly editPlaylistDescription = signal('');
  readonly tempCoverUrl = signal<string | null>(null);

  readonly headerAccentColor = signal(this.defaultTopColor);

  readonly feedbackMessage = signal('');
  readonly isFeedbackVisible = signal(false);

  readonly openSongMenuId = signal<string | null>(null);
  readonly openPlaylistSubmenuSongId = signal<string | null>(null);

  readonly activeAddSongsTab = signal<AddSongsTab>('SUGGESTIONS');
  readonly addSongsSearchQuery = signal('');
  readonly pendingSelectedSongIds = signal<string[]>([]);

  private readonly shuffleSeed = signal(0);

  readonly currentPlaylist = computed<PlaylistResponse | null>(() => {
    const id = this.playlistId();
    if (!id) return null;

    const found = this.playlistState.playlists().find(playlist => playlist.id === id);
    return found ?? null;
  });

  readonly isSystemPlaylist = computed(() => {
    return this.currentPlaylist()?.isSystem === true;
  });

  readonly isLikedSongsPlaylist = computed(() => {
    return this.currentPlaylist()?.isSystem === true;
  });

  /**
   * True cuando el usuario actual es el dueño de la playlist.
   * Usado para:
   *   - Filtrar el menú de 3 puntitos (no-owner ve solo play/shuffle/save).
   *   - Ocultar la sección "Canciones recomendadas" (solo tiene sentido
   *     mientras el dueño edita su playlist; para non-owner es ruido).
   */
  readonly isOwner = computed(() => {
    const user = this.currentUser();
    const playlist = this.currentPlaylist();
    return !!user?.id && !!playlist?.userId && user.id === playlist.userId;
  });

  /**
   * True cuando la playlist está en `mi biblioteca > saved`. Solo aplica a
   * playlists ajenas; las propias no se "guardan" porque ya son tuyas.
   */
  readonly isPlaylistSavedByMe = computed(() => {
    if (this.isOwner()) return false;
    return this.savedPlaylistsState.isPlaylistSaved(this.currentPlaylist()?.id);
  });

  readonly canEditPlaylistIdentity = computed(() => {
    return !this.isLikedSongsPlaylist() && this.isOwner();
  });

  readonly canEditPlaylistPrivacy = computed(() => {
    return !this.isLikedSongsPlaylist() && this.isOwner();
  });

  readonly canDeletePlaylist = computed(() => {
    return !this.isLikedSongsPlaylist() && this.isOwner();
  });

  readonly canAddSongsManually = computed(() => {
    return !this.isLikedSongsPlaylist() && this.isOwner();
  });

  readonly playlistName = computed(() => {
    if (this.isLikedSongsPlaylist()) {
      return 'Tus me gusta';
    }

    return this.currentPlaylist()?.name ?? 'Playlist';
  });

  readonly playlistDescription = computed(() => {
    if (this.isLikedSongsPlaylist()) {
      return '';
    }

    return this.currentPlaylist()?.description ?? '';
  });

  readonly playlistVisibilityLabel = computed(() => {
    if (this.isLikedSongsPlaylist()) {
      return 'Playlist del sistema';
    }

    return !this.currentPlaylist()?.isPublic
      ? 'Playlist privada'
      : 'Playlist pública';
  });

  readonly privacyActionLabel = computed(() => {
    return !this.currentPlaylist()?.isPublic
      ? 'Hacer pública'
      : 'Hacer privada';
  });

  readonly displayOwnerName = computed(() => {
    if (this.isOwner()) {
      const user = this.currentUser();
      return user?.name ?? 'Usuario RubyTune';
    }
    return this._playlistOwnerName() ?? 'Usuario RubyTune';
  });

  readonly displayOwnerAvatarUrl = computed(() => {
    if (this.isOwner()) {
      const user = this.currentUser();
      return user?.avatarUrl || '/assets/icons/avatar-placeholder.png';
    }
    return this._playlistOwnerAvatarUrl() || '/assets/icons/avatar-placeholder.png';
  });

  readonly displayCoverUrl = computed(() => {
    if (this.isLikedSongsPlaylist()) {
      return this.likedSongsCover;
    }

    return this.tempCoverUrl()
      || this.currentPlaylist()?.coverUrl
      || this.defaultPlaylistCover;
  });

  /**
   * Source of truth para los song IDs que se renderizan en la playlist.
   * - System playlist ("Tus me gusta"): deriva de interactionState.likedSongIds(),
   *   que es la fuente real de verdad (tabla song_likes). Esto enmascara cualquier
   *   drift en playlist_songs producido si la sync M2M interaction→playlist falla.
   * - Playlist normal: usa el snapshot cargado por loadPlaylistSongs (el orden
   *   manual por position importa, así que NO se puede sustituir).
   */
  readonly effectiveSongIds = computed<string[]>(() => {
    if (this.isLikedSongsPlaylist()) {
      return this.interactionState.likedSongIds();
    }
    return this.playlistState.getSongIdsForCurrentPlaylist();
  });

  readonly playlistSongs = computed<PlaylistSongRow[]>(() => {
    const playlist = this.currentPlaylist();
    if (!playlist) return [];

    const songIds = this.effectiveSongIds();
    const artists = this.libraryState.artists() as any[];
    const albums = this.libraryState.albums() as any[];
    const addedAtBySongId = this.playlistState.currentPlaylistAddedAtBySongId();
    const nowMs = this.playlistState.now();

    return songIds
      .map((songId, index) => {
        const song = this.libraryState.getSongById(songId) as any;
        if (!song) return null;

        const artist = song.artist
          ?? artists.find((item: any) => item.id === song.artist?.id);
        const album = song.album
          ?? (song.albumId ? albums.find((item: any) => item.id === song.albumId) : null);

        return {
          id: `${playlist.id}-${song.id}-${index}`,
          songId: song.id,
          title: song.title,
          artistName: (artist as any)?.name ?? 'Artista desconocido',
          albumTitle: (album as any)?.title ?? 'Sencillo',
          coverUrl: song.coverUrl || this.defaultPlaylistCover,
          durationLabel: this.formatDuration(song.duration ?? 0),
          addedAgoLabel: this.buildAddedAgoLabel(
            addedAtBySongId.get(song.id) ?? playlist.updatedAt ?? playlist.createdAt,
            nowMs,
          ),
        };
      })
      .filter((row): row is PlaylistSongRow => !!row);
  });

  // El contador real es siempre la longitud de effectiveSongIds (post-load).
  // No dependemos de playlist.songCount del backend porque puede quedar stale
  // (e.g. cuando se ven playlists ajenas hidratadas via getPlaylistById en otro
  // momento que el add/remove song). effectiveSongIds se sincroniza con la
  // tabla playlist_songs vía loadPlaylistSongs.
  readonly songsCount = computed(() => {
    return this.effectiveSongIds().length;
  });

  readonly totalDurationSeconds = computed(() => {
    const songIds = this.effectiveSongIds();

    return songIds.reduce((total, songId) => {
      const song = this.libraryState.getSongById(songId) as any;
      return total + ((song as any)?.duration ?? 0);
    }, 0);
  });

  readonly totalDurationLabel = computed(() => {
    const totalSeconds = this.totalDurationSeconds();

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes} min ${seconds} s`;
  });

  readonly playlistMetaLabel = computed(() => {
    return `${this.displayOwnerName()} • ${this.songsCount()} canciones, ${this.totalDurationLabel()}`;
  });

  readonly hasSongs = computed(() => this.playlistSongs().length > 0);

  readonly recommendedSectionTitle = computed(() => {
    if (this.isLikedSongsPlaylist()) {
      return 'Canciones que te pueden gustar';
    }

    return this.hasSongs()
      ? 'Canciones recomendadas'
      : 'Canciones que te pueden gustar';
  });

  readonly recommendedSectionSubtitle = computed(() => {
    if (this.isLikedSongsPlaylist()) {
      return 'Descubre canciones para seguir llenando tus me gusta';
    }

    return this.hasSongs()
      ? 'Sugerencias segun las canciones de esta playlist'
      : 'Inicia eligiendo una canción para tu playlist';
  });

  readonly visibleRecommendedSongs = computed<RecommendedSongRow[]>(() => {
    const playlist = this.currentPlaylist();
    const songs = this.libraryState.songs() as any[];
    const artists = this.libraryState.artists() as any[];
    const albums = this.libraryState.albums() as any[];
    this.shuffleSeed(); // track for re-evaluation on reload

    if (playlist && songs.length > 0) {
      const loadedSongIds = this.effectiveSongIds();
      const rows = [...songs]
        .filter((song: any) => !loadedSongIds.includes(song.id))
        .sort(() => Math.random() - 0.5)
        .slice(0, 8)
        .map((song: any) => {
          const artist = song.artist
            ?? artists.find((item: any) => item.id === song.artist?.id);
          const album = song.album
            ?? (song.albumId ? albums.find((item: any) => item.id === song.albumId) : null);

          return {
            id: `rec-real-${song.id}`,
            songId: song.id,
            title: song.title,
            artistName: (artist as any)?.name ?? 'Artista desconocido',
            albumTitle: (album as any)?.title ?? 'Sencillo',
            coverUrl: song.coverUrl || this.defaultPlaylistCover,
          };
        });

      if (rows.length > 0) {
        return rows;
      }
    }

    // No hay catálogo poblado todavía (caso poco probable tras el preload
    // global del user-layout). Devolver vacío en vez de un fallback muerto.
    return [];
  });

  readonly customPlaylists = computed<PlaylistResponse[]>(() => {
    const user = this.currentUser();
    if (!user?.id) return [];

    return this.playlistState.getCustomPlaylistsByUser(user.id);
  });

  readonly likedSongsRows = computed<AddSongsRow[]>(() => {
    return this.mapSongIdsToRows(this.interactionState.likedSongIds());
  });

  readonly suggestionRows = computed<AddSongsRow[]>(() => {
    const playlist = this.currentPlaylist();
    const songs = this.libraryState.songs() as any[];
    const artists = this.libraryState.artists() as any[];

    if (!playlist) return [];

    const loadedSongIds = this.effectiveSongIds();

    return songs
      .filter((song: any) => !loadedSongIds.includes(song.id))
      .slice(0, 10)
      .map((song: any) => {
        const artist = song.artist
          ?? artists.find((item: any) => item.id === song.artist?.id);

        return {
          id: `suggestion-${song.id}`,
          songId: song.id,
          title: song.title,
          artistName: (artist as any)?.name ?? 'Artista desconocido',
          coverUrl: song.coverUrl || this.defaultPlaylistCover,
        };
      });
  });

  readonly filteredAddSongsRows = computed<AddSongsRow[]>(() => {
    const term = this.addSongsSearchQuery().trim().toLowerCase();
    const source = this.activeAddSongsTab() === 'LIKED'
      ? this.likedSongsRows()
      : this.suggestionRows();

    if (!term) {
      return source.slice(0, 10);
    }

    return source.filter(item =>
      item.title.toLowerCase().includes(term)
      || item.artistName.toLowerCase().includes(term)
    );
  });

  readonly gradientStyle = computed(() => {
    const color = this.headerAccentColor();
    return `linear-gradient(180deg, ${color} 0%, ${color} 38%, #171717 70%, #0d0d0d 100%)`;
  });

  private bootstrappedForId: string | null = null;

  constructor() {
    // Si el id viene de la URL pero la playlist no está en _playlists
    // (caso típico: usuario abre una playlist pública AJENA desde /user/music),
    // se hidrata acá. getMyPlaylists() solo trae las propias.
    effect(() => {
      const id = this.playlistId();
      if (!id) return;
      this.playlistState.ensurePlaylistLoaded(id);
    });

    // Si el current user NO es el dueño, hidratar el nombre/avatar del creador
    // vía auth-service/users/{id}. Solo para playlists ajenas (las propias usan
    // currentUser directamente). Idempotente por id de playlist.
    effect(() => {
      const playlist = this.currentPlaylist();
      if (!playlist?.id || !playlist.userId) return;
      if (this.isOwner()) {
        this._playlistOwnerName.set(null);
        this._playlistOwnerAvatarUrl.set(null);
        this.fetchedOwnerForPlaylistId = null;
        return;
      }
      if (this.fetchedOwnerForPlaylistId === playlist.id) return;
      this.fetchedOwnerForPlaylistId = playlist.id;
      this.usersApi.getUserById(playlist.userId).subscribe({
        next: (user) => {
          this._playlistOwnerName.set(user.displayName ?? user.email ?? null);
          this._playlistOwnerAvatarUrl.set(user.profilePhotoUrl ?? null);
        },
        error: () => {
          this._playlistOwnerName.set(null);
          this._playlistOwnerAvatarUrl.set(null);
        },
      });
    });

    // Dispara bootstrap cuando currentPlaylist() esté disponible.
    // Si el usuario recarga directo en /user/playlist/:id y playlists() llega tarde,
    // el effect lo cubre sin que dependa del orden de inicialización de otros componentes.
    effect(() => {
      const playlist = this.currentPlaylist();
      if (!playlist?.id) return;
      if (this.bootstrappedForId === playlist.id) return;
      this.bootstrappedForId = playlist.id;
      this.bootstrapPlaylistDetail();
    });

    // Hidrata metadata de canciones que no estén ya en libraryState (recientes/búsqueda).
    // Esto permite que playlist-detail muestre filas para canciones likeadas desde
    // estaciones, álbumes, etc. — sin refetch masivo, solo lo que falta. Usamos
    // effectiveSongIds para que en system playlist se hidraten los likedSongIds
    // (que es lo que realmente se renderiza tras el fix anti-drift).
    effect(() => {
      const ids = this.effectiveSongIds();
      if (ids.length === 0) return;
      this.libraryState.ensureSongsLoaded(ids);
    });

    // Si las playlists todavía no se han cargado (recarga directa en URL),
    // solicítalas. loadPlaylists es idempotente respecto a re-llamadas innecesarias.
    if (this.playlistState.playlists().length === 0) {
      this.playlistState.loadPlaylists();
    }
  }

  /* ===================== */
  /* INIT */
  /* ===================== */
  private bootstrapPlaylistDetail(): void {
    const playlist = this.currentPlaylist();

    if (!playlist) {
      console.warn('Playlist no encontrada');
      return;
    }

    this.playlistState.loadPlaylistSongs(playlist.id!);

    this.editPlaylistName.set(playlist.name ?? '');
    this.editPlaylistDescription.set(playlist.description ?? '');
    this.tempCoverUrl.set(playlist.coverUrl ?? null);

    if (this.isLikedSongsPlaylist()) {
      this.tempCoverUrl.set(null);
      this.updateAccentFromImage(this.likedSongsCover);
      return;
    }

    if (playlist.coverUrl) {
      this.updateAccentFromImage(playlist.coverUrl);
    } else {
      this.headerAccentColor.set(this.defaultTopColor);
    }
  }

  /* ===================== */
  /* UI GENERAL */
  /* ===================== */
  toggleMoreMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isMoreMenuOpen.set(!this.isMoreMenuOpen());
    this.closeSongMenu();
  }

  closeMoreMenu(): void {
    this.isMoreMenuOpen.set(false);
  }

  toggleShuffle(): void {
    this.playerState.toggleShuffle();
  }

  openEditCoverModal(): void {
    if (!this.canEditPlaylistIdentity()) return;

    const playlist = this.currentPlaylist();
    if (!playlist) return;

    this.editPlaylistName.set(playlist.name ?? '');
    this.editPlaylistDescription.set(playlist.description ?? '');
    this.tempCoverUrl.set(playlist.coverUrl ?? null);

    this.isMoreMenuOpen.set(false);
    this.isEditCoverModalOpen.set(true);
  }

  closeEditCoverModal(): void {
    const playlist = this.currentPlaylist();

    this.editPlaylistName.set(playlist?.name ?? '');
    this.editPlaylistDescription.set(playlist?.description ?? '');
    this.tempCoverUrl.set(playlist?.coverUrl ?? null);

    if (this.isLikedSongsPlaylist()) {
      this.headerAccentColor.set(this.defaultTopColor);
      this.updateAccentFromImage(this.likedSongsCover);
      this.isEditCoverModalOpen.set(false);
      return;
    }

    if (playlist?.coverUrl) {
      this.updateAccentFromImage(playlist.coverUrl);
    } else {
      this.headerAccentColor.set(this.defaultTopColor);
    }

    this.isEditCoverModalOpen.set(false);
  }

  /* ===================== */
  /* MODAL AGREGAR CANCIONES */
  /* ===================== */
  openAddSongsModal(event?: MouseEvent): void {
    event?.stopPropagation();

    if (!this.canAddSongsManually()) {
      this.closeMoreMenu();
      return;
    }

    const playlist = this.currentPlaylist();
    if (!playlist) return;

    this.pendingSelectedSongIds.set([...this.playlistState.getSongIdsForCurrentPlaylist()]);
    this.activeAddSongsTab.set('SUGGESTIONS');
    this.addSongsSearchQuery.set('');
    this.isAddSongsModalOpen.set(true);
    this.closeMoreMenu();
    this.closeSongMenu();
  }

  closeAddSongsModal(): void {
    this.isAddSongsModalOpen.set(false);
    this.addSongsSearchQuery.set('');
    this.activeAddSongsTab.set('SUGGESTIONS');
    this.pendingSelectedSongIds.set([]);
  }

  setAddSongsTab(tab: AddSongsTab): void {
    this.activeAddSongsTab.set(tab);
    this.addSongsSearchQuery.set('');
  }

  onAddSongsSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addSongsSearchQuery.set(input.value);
  }

  isPendingSongSelected(songId: string): boolean {
    return this.pendingSelectedSongIds().includes(songId);
  }

  togglePendingSongSelection(songId: string): void {
    const current = this.pendingSelectedSongIds();

    if (current.includes(songId)) {
      this.pendingSelectedSongIds.set(current.filter(id => id !== songId));
      return;
    }

    this.pendingSelectedSongIds.set([...current, songId]);
  }

  saveAddSongsSelection(): void {
    const playlist = this.currentPlaylist();
    if (!playlist?.id) return;

    const currentIds = this.playlistState.getSongIdsForCurrentPlaylist();
    const nextIds = [...this.pendingSelectedSongIds()];

    nextIds.filter(id => !currentIds.includes(id))
      .forEach(id => this.playlistState.addSongToPlaylist(playlist.id!, id));

    currentIds.filter(id => !nextIds.includes(id))
      .forEach(id => this.playlistState.removeSongFromPlaylist(playlist.id!, id));

    const firstSelectedSong = (this.libraryState.songs() as any[]).find((song: any) => song.id === nextIds[0]);
    if (!playlist.coverUrl && (firstSelectedSong as any)?.coverUrl) {
      this.tempCoverUrl.set((firstSelectedSong as any).coverUrl);
      this.updateAccentFromImage((firstSelectedSong as any).coverUrl);
    }

    this.closeAddSongsModal();
    this.showFeedback('Playlist actualizada');
  }

  /* ===================== */
  /* FORM EDICIÓN */
  /* ===================== */
  onPlaylistNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.editPlaylistName.set(input.value);
  }

  onPlaylistDescriptionInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.editPlaylistDescription.set(textarea.value);
  }

  onSelectCover(event: Event, fileInput: HTMLInputElement): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      this.tempCoverUrl.set(result);

      if (result) {
        this.updateAccentFromImage(result);
      }

      fileInput.value = '';
    };

    reader.readAsDataURL(file);
  }

  removeSelectedCover(fileInput: HTMLInputElement): void {
    this.tempCoverUrl.set(null);
    this.headerAccentColor.set(this.defaultTopColor);
    fileInput.value = '';
  }

  savePlaylistCover(): void {
    if (!this.canEditPlaylistIdentity()) return;

    const playlist = this.currentPlaylist();
    if (!playlist) return;

    const nextName = this.editPlaylistName().trim() || playlist.name;
    const nextDescription = this.editPlaylistDescription().trim() || null;
    const nextCoverUrl = this.tempCoverUrl();

    this.playlistState.updatePlaylist(playlist.id!, {
      name: nextName,
      description: nextDescription,
      coverUrl: nextCoverUrl,
    });

    if (nextCoverUrl) {
      this.updateAccentFromImage(nextCoverUrl);
    } else {
      this.headerAccentColor.set(this.defaultTopColor);
    }

    this.isEditCoverModalOpen.set(false);
  }

  /* ===================== */
  /* ACCIONES PLAYLIST */
  /* ===================== */
  addToPlaylist(event?: MouseEvent): void {
    this.openAddSongsModal(event);
  }

  editPlaylistOrder(): void {
    this.closeMoreMenu();
  }

  togglePlaylistPrivacy(): void {
    if (!this.canEditPlaylistPrivacy()) {
      this.isMoreMenuOpen.set(false);
      return;
    }

    const playlist = this.currentPlaylist();
    if (!playlist) return;

    this.playlistState.updatePlaylist(playlist.id!, {
      isPublic: playlist.isPublic !== true,
    });

    this.isMoreMenuOpen.set(false);
  }

  deletePlaylist(): void {
    if (!this.canDeletePlaylist()) {
      this.isMoreMenuOpen.set(false);
      return;
    }

    const playlist = this.currentPlaylist();
    if (!playlist?.id) return;

    this.playlistState.deletePlaylist(playlist.id, () => {
      this.isMoreMenuOpen.set(false);
      this.router.navigate(['/user/library']);
    });
  }

  /**
   * Toggle save/unsave para playlists ajenas (non-owner). El menú 3-puntitos
   * solo expone esta acción cuando isOwner === false.
   */
  togglePlaylistSaveFromMenu(): void {
    const playlist = this.currentPlaylist();
    if (!playlist?.id || this.isOwner()) {
      this.isMoreMenuOpen.set(false);
      return;
    }
    if (this.savedPlaylistsState.isPlaylistSaved(playlist.id)) {
      this.savedPlaylistsState.unsavePlaylist(playlist.id);
    } else {
      this.savedPlaylistsState.savePlaylist(playlist);
    }
    this.isMoreMenuOpen.set(false);
  }

  playPlaylist(): void {
    const playlist = this.currentPlaylist();
    const firstSongRow = this.playlistSongs()[0];
    const currentSong = this.playerState.currentSong();

    if (!playlist || !firstSongRow) return;

    const playlistSongIds = this.effectiveSongIds();

    if (
      currentSong &&
      playlistSongIds.includes(currentSong.id) &&
      this.playerState.isPlaying()
    ) {
      this.playerState.pause();
      return;
    }

    if (
      currentSong &&
      playlistSongIds.includes(currentSong.id) &&
      !this.playerState.isPlaying()
    ) {
      this.playerState.resume();
      return;
    }

    const queue = this.buildPlaylistPlayerQueue();
    if (queue.length === 0) return;
    this.playerState.playQueue(queue as any, 0);
  }

  playSong(song: PlaylistSongRow): void {
    const currentSong = this.playerState.currentSong();

    if (currentSong?.id === song.songId && this.playerState.isPlaying()) {
      this.playerState.pause();
      return;
    }
    if (currentSong?.id === song.songId && !this.playerState.isPlaying()) {
      this.playerState.resume();
      return;
    }

    const queue = this.buildPlaylistPlayerQueue();
    const idx = queue.findIndex((s: any) => s.id === song.songId);
    if (idx < 0) return;
    this.playerState.playQueue(queue as any, idx);
  }

  /**
   * Reproduce una canción de la sección de recomendaciones (tanto "Canciones
   * que te pueden gustar" en Tus me gusta como "Canciones recomendadas" en
   * playlists normales). Estas filas están explícitamente excluidas de la
   * playlist actual (ver visibleRecommendedSongs), por lo que NO pueden
   * reutilizar playSong/buildPlaylistPlayerQueue — la cola de la playlist
   * no las contiene y el findIndex daría -1. Reproducimos como canción suelta
   * vía PlayerState.playSong, que normaliza audioUrl/artistName/etc desde el
   * SongResponse crudo de libraryState.
   */
  playRecommendedSong(song: RecommendedSongRow): void {
    const currentSong = this.playerState.currentSong();

    if (currentSong?.id === song.songId && this.playerState.isPlaying()) {
      this.playerState.pause();
      return;
    }
    if (currentSong?.id === song.songId && !this.playerState.isPlaying()) {
      this.playerState.resume();
      return;
    }

    const songRes = (this.libraryState.songs() as any[]).find((s: any) => s.id === song.songId);
    if (!songRes) return;
    this.playerState.playSong(songRes as any);
  }

  /**
   * Resolves every PlaylistSongRow into its underlying SongResponse so the
   * whole playlist (or "Tus me gusta") becomes the playback queue — prev/next
   * in the footer and the shuffle toggle both operate on this list.
   */
  private buildPlaylistPlayerQueue(): any[] {
    const library = this.libraryState.songs() as any[];
    return this.playlistSongs()
      .map(row => library.find(s => s.id === row.songId))
      .filter((s): s is any => !!s);
  }

  isPlaylistPlaying(): boolean {
    const playlist = this.currentPlaylist();
    const currentSong = this.playerState.currentSong();

    if (!playlist || !currentSong) return false;

    return this.effectiveSongIds().includes(currentSong.id) && this.playerState.isPlaying();
  }

  isSongPlaying(songId: string): boolean {
    const currentSong = this.playerState.currentSong();
    return !!currentSong && currentSong.id === songId && this.playerState.isPlaying();
  }

  /** True cuando la canción dada es la current del PlayerState (independiente de pause). */
  isCurrentPlayerSong(songId: string): boolean {
    return this.playerState.currentSong()?.id === songId;
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
    this.closeMoreMenu();
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
  /* LIKES */
  /* ===================== */
  toggleSongLike(songId: string): void {
    if (this.isSongLiked(songId)) {
      this.removeFromLikedSongs(songId);
      return;
    }

    this.addSongToLikedSongs(songId);
  }

  isSongLiked(songId: string): boolean {
    return this.interactionState.isSongLiked(songId);
  }

  addSongToLikedSongs(songId: string): void {
    this.interactionState.likeSong(songId);
    this.closeSongMenu();
    this.showFeedback('Se agregó a Tus me gusta');
  }

  removeFromLikedSongs(songId: string): void {
    this.interactionState.unlikeSong(songId);
    this.closeSongMenu();
    this.showFeedback('Se eliminó de Tus me gusta');
  }

  /**
   * Removes a song from the current (non-system) playlist. "Tus me gusta"
   * is covered by removeFromLikedSongs + the `@if (!isLikedSongsPlaylist())`
   * guard in the template, so we never reach here for the liked playlist.
   * PlaylistState.removeSongFromPlaylist already patches the local signals
   * (and fires DELETE /playlists/:id/songs/:songId), so the row disappears
   * immediately and the change persists across reloads.
   */
  removeSongFromCurrentPlaylist(songId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    const playlistId = this.playlistId();
    if (!playlistId || this.isLikedSongsPlaylist()) return;

    this.playlistState.removeSongFromPlaylist(playlistId, songId, () => {
      this.showFeedback('Se eliminó de esta playlist');
    });
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
      {
        name: `Mi playlist n.° ${nextNumber}`,
        description: null,
        isPublic: true,
      },
      (created) => {
        this.playlistState.addSongToPlaylist(created.id!, songId);

        const storedSong = (this.libraryState.songs() as any[]).find((song: any) => song.id === songId);
        if ((storedSong as any)?.coverUrl) {
          this.playlistState.updatePlaylist(created.id!, {
            coverUrl: (storedSong as any).coverUrl,
          });
        }
      },
    );

    this.closeSongMenu();
    this.showFeedback('Se creó una nueva playlist');
  }

  addSongToExistingPlaylist(playlistId: string, songId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (!playlistId || !songId) return;

    this.playlistState.addSongToPlaylist(playlistId, songId);

    const playlist = this.playlistState.playlists().find(item => item.id === playlistId);
    const storedSong = (this.libraryState.songs() as any[]).find((song: any) => song.id === songId);

    if (playlist && !playlist.coverUrl && (storedSong as any)?.coverUrl) {
      this.playlistState.updatePlaylist(playlistId, {
        coverUrl: (storedSong as any).coverUrl,
      });
    }

    this.closeSongMenu();
    this.showFeedback('Se agregó a la playlist');
  }

  /* ===================== */
  /* SONG NAVIGATION */
  /* ===================== */
  hasAlbum(song: PlaylistSongRow): boolean {
    const storedSong = (this.libraryState.songs() as any[]).find((item: any) => item.id === song.songId);
    return !!(storedSong as any)?.album?.id;
  }

  goToArtist(song: PlaylistSongRow, event?: MouseEvent): void {
    event?.stopPropagation();

    const storedSong = (this.libraryState.songs() as any[]).find((item: any) => item.id === song.songId);
    const artistId = (storedSong as any)?.artist?.id;
    if (!artistId) return;

    this.closeSongMenu();
    this.router.navigate(['/user/artist', artistId]);
  }

  goToAlbum(song: PlaylistSongRow, event?: MouseEvent): void {
    event?.stopPropagation();

    const storedSong = (this.libraryState.songs() as any[]).find((item: any) => item.id === song.songId);
    const albumId = (storedSong as any)?.album?.id;
    if (!albumId) return;

    this.closeSongMenu();
    this.router.navigate(['/user/album', albumId]);
  }

  addRecommendedSong(song: RecommendedSongRow): void {
    const playlist = this.currentPlaylist();
    if (!playlist) return;

    if (this.isLikedSongsPlaylist()) {
      this.addSongToLikedSongs(song.songId);
      return;
    }

    this.playlistState.addSongToPlaylist(playlist.id!, song.songId);

    const currentCover = playlist.coverUrl;
    if (!currentCover) {
      this.tempCoverUrl.set(song.coverUrl);
      this.playlistState.updatePlaylist(playlist.id!, {
        coverUrl: song.coverUrl,
      });
      this.updateAccentFromImage(song.coverUrl);
    }

    console.log('Canción agregada a playlist:', song);
  }

  reloadRecommendations(): void {
    this.shuffleSeed.set(this.shuffleSeed() + 1);
  }

  goBackToLibrary(): void {
    this.router.navigate(['/user/library']);
  }

  /* ===================== */
  /* CLICK FUERA */
  /* ===================== */
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMoreMenu();
    this.closeSongMenu();
  }

  /* ===================== */
  /* HELPERS */
  /* ===================== */
  private mapSongIdsToRows(songIds: string[]): AddSongsRow[] {
    const songs = this.libraryState.songs() as any[];
    const artists = this.libraryState.artists() as any[];

    return songIds
      .map((songId, index) => {
        const song = songs.find((item: any) => item.id === songId);
        if (!song) return null;

        const artist = (song as any).artist
          ?? artists.find((item: any) => item.id === (song as any).artist?.id);

        return {
          id: `add-${(song as any).id}-${index}`,
          songId: (song as any).id,
          title: (song as any).title,
          artistName: (artist as any)?.name ?? 'Artista desconocido',
          coverUrl: (song as any).coverUrl || this.defaultPlaylistCover,
        };
      })
      .filter((row): row is AddSongsRow => !!row);
  }

  private formatDuration(totalSeconds: number): string {
    const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  private buildAddedAgoLabel(isoDate: string | null | undefined, nowMs: number): string {
    if (!isoDate) return 'hace un momento';

    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return 'hace un momento';

    const diffMs = nowMs - date.getTime();
    const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

    if (diffMinutes < 60) {
      return `hace ${diffMinutes} minuto${diffMinutes === 1 ? '' : 's'}`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `hace ${diffHours} hora${diffHours === 1 ? '' : 's'}`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `hace ${diffDays} día${diffDays === 1 ? '' : 's'}`;
  }

  private showFeedback(message: string): void {
    this.feedbackMessage.set(message);
    this.isFeedbackVisible.set(true);

    window.clearTimeout((this as { feedbackTimeout?: number }).feedbackTimeout);
    (this as { feedbackTimeout?: number }).feedbackTimeout = window.setTimeout(() => {
      this.isFeedbackVisible.set(false);
      this.feedbackMessage.set('');
    }, 2200);
  }

  /* ===================== */
  /* COLOR DOMINANTE */
  /* ===================== */
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

      const softened = this.softenRgb(avgRed, avgGreen, avgBlue);
      this.headerAccentColor.set(softened);
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
