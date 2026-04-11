import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { Playlist } from '../../models/playlist.model';
import { PlaylistState } from '../../state/playlist.state';
import { PlayerState } from '../../state/player.state';

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

interface StoredArtist {
  id: string;
  name: string;
  photoUrl?: string | null;
}

interface StoredAlbum {
  id: string;
  title: string;
  artistId: string;
  coverUrl?: string | null;
}

@Component({
  selector: 'app-playlist-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './playlist-detail.component.html',
  styleUrls: ['./playlist-detail.component.scss'],
})
export class PlaylistDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authState = inject(AuthState);
  private readonly playlistState = inject(PlaylistState);
  private readonly playerState = inject(PlayerState);

  private readonly SONGS_STORAGE_KEY = 'ruby_songs';
  private readonly ARTISTS_STORAGE_KEY = 'ruby_artists';
  private readonly ALBUMS_STORAGE_KEY = 'ruby_albums';

  private readonly defaultTopColor = '#4b4b4b';
  private readonly defaultPlaylistCover = '/assets/icons/playlist-cover-placeholder.png';
  private readonly likedSongsCover = '/assets/icons/library-liked-songs-cover.png';

  readonly currentUser = this.authState.currentUser;

  readonly playlistId = signal(this.route.snapshot.paramMap.get('id') ?? '');

  readonly isMoreMenuOpen = signal(false);
  readonly isEditCoverModalOpen = signal(false);
  readonly isShuffleEnabled = signal(false);

  readonly editPlaylistName = signal('');
  readonly editPlaylistDescription = signal('');
  readonly tempCoverUrl = signal<string | null>(null);

  readonly headerAccentColor = signal(this.defaultTopColor);

  readonly feedbackMessage = signal('');
  readonly isFeedbackVisible = signal(false);

  readonly openSongMenuId = signal<string | null>(null);
  readonly openPlaylistSubmenuSongId = signal<string | null>(null);

  private readonly songsCatalog = signal<StoredSong[]>(this.loadStorageArray<StoredSong>(this.SONGS_STORAGE_KEY));
  private readonly artistsCatalog = signal<StoredArtist[]>(this.loadStorageArray<StoredArtist>(this.ARTISTS_STORAGE_KEY));
  private readonly albumsCatalog = signal<StoredAlbum[]>(this.loadStorageArray<StoredAlbum>(this.ALBUMS_STORAGE_KEY));

  /* ===================== */
  /* FALLBACK TEMPORAL */
  /* ===================== */
  readonly initialRecommendedSongs = signal<RecommendedSongRow[]>([]);

  /* ===================== */
  /* PLAYLIST ACTUAL */
  /* ===================== */
  readonly currentPlaylist = computed<Playlist | null>(() => {
    const id = this.playlistId();
    if (!id) return null;

    const found = this.playlistState.playlists().find(playlist => playlist.id === id);
    return found ?? null;
  });

  readonly isSystemPlaylist = computed(() => {
    return this.currentPlaylist()?.type === 'SYSTEM';
  });

  readonly isLikedSongsPlaylist = computed(() => {
    const playlist = this.currentPlaylist();

    return (
      playlist?.type === 'SYSTEM' &&
      playlist.systemType === 'LIKED_SONGS'
    );
  });

  readonly canEditPlaylistIdentity = computed(() => {
    return !this.isLikedSongsPlaylist();
  });

  readonly canEditPlaylistPrivacy = computed(() => {
    return !this.isLikedSongsPlaylist();
  });

  readonly canDeletePlaylist = computed(() => {
    return !this.isLikedSongsPlaylist();
  });

  readonly canAddSongsManually = computed(() => {
    return !this.isLikedSongsPlaylist();
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

    return this.currentPlaylist()?.visibility === 'PRIVATE'
      ? 'Playlist privada'
      : 'Playlist pública';
  });

  readonly privacyActionLabel = computed(() => {
    return this.currentPlaylist()?.visibility === 'PRIVATE'
      ? 'Hacer pública'
      : 'Hacer privada';
  });

  readonly displayOwnerName = computed(() => {
    const user = this.currentUser();
    return user?.name ?? 'Usuario RubyTune';
  });

  readonly displayOwnerAvatarUrl = computed(() => {
    const user = this.currentUser();
    return user?.avatarUrl || '/assets/icons/avatar-placeholder.png';
  });

  readonly displayCoverUrl = computed(() => {
    if (this.isLikedSongsPlaylist()) {
      return this.likedSongsCover;
    }

    return this.tempCoverUrl()
      || this.currentPlaylist()?.coverUrl
      || this.defaultPlaylistCover;
  });

  readonly playlistSongs = computed<PlaylistSongRow[]>(() => {
    const playlist = this.currentPlaylist();
    if (!playlist) return [];

    const songs = this.songsCatalog();
    const artists = this.artistsCatalog();
    const albums = this.albumsCatalog();

    return playlist.songIds
      .map((songId, index) => {
        const song = songs.find(item => item.id === songId);
        if (!song) return null;

        const artist = artists.find(item => item.id === song.artistId);
        const album = song.albumId
          ? albums.find(item => item.id === song.albumId)
          : null;

        return {
          id: `${playlist.id}-${song.id}-${index}`,
          songId: song.id,
          title: song.title,
          artistName: artist?.name ?? 'Artista desconocido',
          albumTitle: album?.title ?? 'Sencillo',
          coverUrl: song.coverUrl || this.defaultPlaylistCover,
          durationLabel: this.formatDuration(song.durationSeconds),
          addedAgoLabel: this.buildAddedAgoLabel(playlist.updatedAt || playlist.createdAt),
        };
      })
      .filter((row): row is PlaylistSongRow => !!row);
  });

  readonly songsCount = computed(() => this.playlistSongs().length);

  readonly totalDurationSeconds = computed(() => {
    const playlist = this.currentPlaylist();
    const songs = this.songsCatalog();

    if (!playlist) return 0;

    return playlist.songIds.reduce((total, songId) => {
      const song = songs.find(item => item.id === songId);
      return total + (song?.durationSeconds ?? 0);
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
    const songs = this.songsCatalog();
    const artists = this.artistsCatalog();
    const albums = this.albumsCatalog();

    if (playlist && songs.length > 0) {
      const rows = songs
        .filter(song => !playlist.songIds.includes(song.id))
        .slice(0, 8)
        .map(song => {
          const artist = artists.find(item => item.id === song.artistId);
          const album = song.albumId
            ? albums.find(item => item.id === song.albumId)
            : null;

          return {
            id: `rec-real-${song.id}`,
            songId: song.id,
            title: song.title,
            artistName: artist?.name ?? 'Artista desconocido',
            albumTitle: album?.title ?? 'Sencillo',
            coverUrl: song.coverUrl || this.defaultPlaylistCover,
          };
        });

      if (rows.length > 0) {
        return rows;
      }
    }

    return this.initialRecommendedSongs().slice(0, 8);
  });

  readonly customPlaylists = computed<Playlist[]>(() => {
    const user = this.currentUser();
    if (!user?.id) return [];

    return this.playlistState.getCustomPlaylistsByUser(user.id);
  });

  readonly gradientStyle = computed(() => {
    const color = this.headerAccentColor();
    return `linear-gradient(180deg, ${color} 0%, ${color} 38%, #171717 70%, #0d0d0d 100%)`;
  });

  constructor() {
    this.bootstrapPlaylistDetail();
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

    this.editPlaylistName.set(playlist.name);
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
    this.isShuffleEnabled.set(!this.isShuffleEnabled());
  }

  openEditCoverModal(): void {
    if (!this.canEditPlaylistIdentity()) return;

    const playlist = this.currentPlaylist();
    if (!playlist) return;

    this.editPlaylistName.set(playlist.name);
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

    this.playlistState.updatePlaylist(playlist.id, {
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
  addToPlaylist(): void {
    if (!this.canAddSongsManually()) {
      this.isMoreMenuOpen.set(false);
      return;
    }

    this.isMoreMenuOpen.set(false);
    console.log('Abrir modal para agregar canciones a la playlist');
  }

  editPlaylistOrder(): void {
    if (this.isLikedSongsPlaylist()) {
      this.isMoreMenuOpen.set(false);
      return;
    }

    this.isMoreMenuOpen.set(false);
    console.log('Editar orden de playlist - pendiente');
  }

  togglePlaylistPrivacy(): void {
    if (!this.canEditPlaylistPrivacy()) {
      this.isMoreMenuOpen.set(false);
      return;
    }

    const playlist = this.currentPlaylist();
    if (!playlist) return;

    const nextVisibility = playlist.visibility === 'PRIVATE' ? 'PUBLIC' : 'PRIVATE';

    this.playlistState.updatePlaylist(playlist.id, {
      visibility: nextVisibility,
    });

    this.isMoreMenuOpen.set(false);
    console.log(`Playlist actualizada a ${nextVisibility}`);
  }

  deletePlaylist(): void {
    if (!this.canDeletePlaylist()) {
      this.isMoreMenuOpen.set(false);
      return;
    }

    this.isMoreMenuOpen.set(false);
    console.log('Eliminar playlist - pendiente');
  }

  playPlaylist(): void {
    const playlist = this.currentPlaylist();
    const firstSongRow = this.playlistSongs()[0];
    const currentSong = this.playerState.currentSong();

    if (!playlist || !firstSongRow) return;

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

    const firstStoredSong = this.songsCatalog().find(item => item.id === firstSongRow.songId);
    if (!firstStoredSong) return;

    this.playerState.playSong(firstStoredSong);
  }

  playSong(song: PlaylistSongRow): void {
    const storedSong = this.songsCatalog().find(item => item.id === song.songId);
    const currentSong = this.playerState.currentSong();

    if (!storedSong) return;

    if (currentSong?.id === storedSong.id && this.playerState.isPlaying()) {
      this.playerState.pause();
      return;
    }

    if (currentSong?.id === storedSong.id && !this.playerState.isPlaying()) {
      this.playerState.resume();
      return;
    }

    this.playerState.playSong(storedSong);
  }

  isPlaylistPlaying(): boolean {
    const playlist = this.currentPlaylist();
    const currentSong = this.playerState.currentSong();

    if (!playlist || !currentSong) return false;

    return playlist.songIds.includes(currentSong.id) && this.playerState.isPlaying();
  }

  isSongPlaying(songId: string): boolean {
    const currentSong = this.playerState.currentSong();
    return !!currentSong && currentSong.id === songId && this.playerState.isPlaying();
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
    const user = this.currentUser();
    if (!user?.id) return false;

    const likedPlaylist = this.playlistState.getLikedSongsPlaylist(user.id);
    return likedPlaylist?.songIds.includes(songId) ?? false;
  }

  addSongToLikedSongs(songId: string): void {
    const user = this.currentUser();
    if (!user?.id) return;

    this.playlistState.addSongToLikedSongs(user.id, songId);
    this.closeSongMenu();
    this.showFeedback('Se agregó a Tus me gusta');
  }

  removeFromLikedSongs(songId: string): void {
    const user = this.currentUser();
    if (!user?.id) return;

    this.playlistState.removeSongFromLikedSongs(user.id, songId);
    this.closeSongMenu();
    this.showFeedback('Se eliminó de Tus me gusta');
  }

  /* ===================== */
  /* SONG PLAYLISTS */
  /* ===================== */
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
    this.showFeedback('Se creó una nueva playlist');
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
    this.showFeedback('Se agregó a la playlist');
  }

  /* ===================== */
  /* SONG NAVIGATION */
  /* ===================== */
  hasAlbum(song: PlaylistSongRow): boolean {
    const storedSong = this.songsCatalog().find(item => item.id === song.songId);
    return !!storedSong?.albumId;
  }

  goToArtist(song: PlaylistSongRow, event?: MouseEvent): void {
    event?.stopPropagation();

    const storedSong = this.songsCatalog().find(item => item.id === song.songId);
    if (!storedSong?.artistId) return;

    this.closeSongMenu();
    this.router.navigate(['/user/artist', storedSong.artistId]);
  }

  goToAlbum(song: PlaylistSongRow, event?: MouseEvent): void {
    event?.stopPropagation();

    const storedSong = this.songsCatalog().find(item => item.id === song.songId);
    if (!storedSong?.albumId) return;

    this.closeSongMenu();
    this.router.navigate(['/user/album', storedSong.albumId]);
  }

  addRecommendedSong(song: RecommendedSongRow): void {
    const playlist = this.currentPlaylist();
    if (!playlist) return;

    if (this.isLikedSongsPlaylist()) {
      this.addSongToLikedSongs(song.songId);
      return;
    }

    this.playlistState.addSongToPlaylist(playlist.id, song.songId);

    const currentCover = playlist.coverUrl;
    if (!currentCover) {
      this.tempCoverUrl.set(song.coverUrl);
      this.playlistState.updatePlaylist(playlist.id, {
        coverUrl: song.coverUrl,
      });
      this.updateAccentFromImage(song.coverUrl);
    }

    console.log('Canción agregada a playlist:', song);
  }

  reloadRecommendations(): void {
    const realSongs = [...this.songsCatalog()];
    if (realSongs.length > 0) {
      const shuffled = realSongs.sort(() => Math.random() - 0.5);
      this.songsCatalog.set(shuffled);
      return;
    }

    const shuffledFallback = [...this.initialRecommendedSongs()].sort(() => Math.random() - 0.5);
    this.initialRecommendedSongs.set(shuffledFallback);
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
  /* HELPERS STORAGE / MAPEO */
  /* ===================== */
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

  private formatDuration(totalSeconds: number): string {
    const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  private buildAddedAgoLabel(isoDate: string | null | undefined): string {
    if (!isoDate) return 'hace un momento';

    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return 'hace un momento';

    const diffMs = Date.now() - date.getTime();
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