import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { PlayerState } from '../../state/player.state';
import { PlaylistState } from '../../state/playlist.state';
import { Playlist } from '../../models/playlist.model';

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

interface RelatedAlbumCard {
  id: string;
  title: string;
  coverUrl: string;
  releaseYear: string;
}

@Component({
  selector: 'app-album-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './album-detail.component.html',
  styleUrls: ['./album-detail.component.scss'],
})
export class AlbumDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authState = inject(AuthState);
  private readonly playlistState = inject(PlaylistState);
  private readonly playerState = inject(PlayerState);
  private readonly destroyRef = inject(DestroyRef);

  private readonly ALBUMS_KEY = 'ruby_albums';
  private readonly ARTISTS_KEY = 'ruby_artists';
  private readonly SONGS_KEY = 'ruby_songs';
  private readonly USER_LIBRARY_KEY = 'ruby_user_library';

  private readonly defaultTopColor = '#5b1a1a';
  private readonly defaultAlbumCover = '/assets/icons/playlist-cover-placeholder.png';
  private readonly defaultAvatar = '/assets/icons/avatar-placeholder.png';

  readonly currentUser = this.authState.currentUser;
  readonly albumId = signal(this.route.snapshot.paramMap.get('id') ?? '');

  readonly openSongMenuId = signal<string | null>(null);
  readonly openPlaylistSubmenuSongId = signal<string | null>(null);

  readonly openRelatedAlbumMenuId = signal<string | null>(null);
  readonly openRelatedAlbumPlaylistSubmenuId = signal<string | null>(null);

  readonly headerAccentColor = signal(this.defaultTopColor);

  private readonly albumsCatalog = signal<StoredAlbum[]>(this.loadStorageArray<StoredAlbum>(this.ALBUMS_KEY));
  private readonly artistsCatalog = signal<StoredArtist[]>(this.loadStorageArray<StoredArtist>(this.ARTISTS_KEY));
  private readonly songsCatalog = signal<StoredSong[]>(this.loadStorageArray<StoredSong>(this.SONGS_KEY));
  private readonly userLibrary = signal<LibraryItem[]>(this.loadStorageArray<LibraryItem>(this.USER_LIBRARY_KEY));

  readonly currentAlbum = computed<StoredAlbum | null>(() => {
    const id = this.albumId();
    if (!id) return null;

    return this.albumsCatalog().find(album => album.id === id) ?? null;
  });

  readonly currentArtist = computed<StoredArtist | null>(() => {
    const album = this.currentAlbum();
    if (!album) return null;

    return this.artistsCatalog().find(artist => artist.id === album.artistId) ?? null;
  });

  readonly albumSongs = computed<AlbumSongRow[]>(() => {
    const album = this.currentAlbum();
    const user = this.currentUser();

    if (!album) return [];

    const likedPlaylist = user?.id
      ? this.playlistState.getLikedSongsPlaylist(user.id) ?? this.playlistState.ensureLikedSongsPlaylist(user.id)
      : undefined;

    return this.songsCatalog()
      .filter(song => song.albumId === album.id)
      .map((song, index) => {
        const artist = this.artistsCatalog().find(item => item.id === song.artistId);

        return {
          id: `${album.id}-${song.id}`,
          index: index + 1,
          songId: song.id,
          title: song.title,
          artistId: song.artistId,
          artistName: artist?.name ?? 'Artista desconocido',
          durationLabel: this.formatDuration(song.durationSeconds),
          isLiked: likedPlaylist?.songIds.includes(song.id) ?? false,
        };
      });
  });

  readonly songsCount = computed(() => this.albumSongs().length);

  readonly totalDurationSeconds = computed(() => {
    return this.songsCatalog()
      .filter(song => song.albumId === this.albumId())
      .reduce((total, song) => total + (song.durationSeconds ?? 0), 0);
  });

  readonly totalDurationLabel = computed(() => {
    const totalSeconds = this.totalDurationSeconds();
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes} min ${seconds} s`;
  });

  readonly albumMetaLabel = computed(() => {
    return `${this.songsCount()} canción${this.songsCount() === 1 ? '' : 'es'} · ${this.totalDurationLabel()}`;
  });

  readonly displayAlbumCover = computed(() => {
    return this.currentAlbum()?.coverUrl || this.defaultAlbumCover;
  });

  readonly displayAlbumTitle = computed(() => {
    return this.currentAlbum()?.title ?? 'Álbum';
  });

  readonly displayArtistName = computed(() => {
    return this.currentArtist()?.name ?? 'Artista desconocido';
  });

  readonly displayArtistPhoto = computed(() => {
    return this.currentArtist()?.photoUrl || this.defaultAvatar;
  });

  readonly isAlbumSaved = computed(() => {
    const user = this.currentUser();
    const album = this.currentAlbum();

    if (!user?.id || !album?.id) return false;

    return this.userLibrary().some(
      item =>
        item.userId === user.id &&
        item.itemType === 'ALBUM' &&
        item.itemId === album.id
    );
  });

  readonly albumGradient = computed(() => {
    const color = this.headerAccentColor();
    return `linear-gradient(180deg, ${color} 0%, ${color} 32%, #131313 68%, #090909 100%)`;
  });

  readonly customPlaylists = computed<Playlist[]>(() => {
    const user = this.currentUser();
    if (!user?.id) return [];

    return this.playlistState.getCustomPlaylistsByUser(user.id);
  });

  readonly relatedAlbums = computed<RelatedAlbumCard[]>(() => {
    const currentAlbum = this.currentAlbum();
    if (!currentAlbum) return [];

    return this.albumsCatalog()
      .filter(album => album.artistId === currentAlbum.artistId && album.id !== currentAlbum.id)
      .map(album => ({
        id: album.id,
        title: album.title,
        coverUrl: album.coverUrl || this.defaultAlbumCover,
        releaseYear: this.extractYear(album.releaseDate || album.createdAt),
      }));
  });

  readonly hasRelatedAlbums = computed(() => this.relatedAlbums().length > 0);

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(paramMap => {
        const nextAlbumId = paramMap.get('id') ?? '';

        this.albumId.set(nextAlbumId);
        this.closeSongMenu();
        this.closeRelatedAlbumMenu();
        this.bootstrapAlbumDetail();

        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
  }

  /* ===================== */
  /* INIT */
  /* ===================== */
  private bootstrapAlbumDetail(): void {
    const album = this.currentAlbum();

    if (!album) {
      this.headerAccentColor.set(this.defaultTopColor);
      return;
    }

    if (album.coverUrl) {
      this.updateAccentFromImage(album.coverUrl);
    } else {
      this.headerAccentColor.set(this.defaultTopColor);
    }
  }

  /* ===================== */
  /* PLAYBACK */
  /* ===================== */
  playAlbum(): void {
    const firstSong = this.albumSongs()[0];
    if (!firstSong) return;

    if (this.isAlbumPlaying()) {
      this.playerState.pause();
      return;
    }

    this.playSong(firstSong);
  }

  playSong(songRow: AlbumSongRow): void {
    const storedSong = this.songsCatalog().find(song => song.id === songRow.songId);
    if (!storedSong) return;

    if (this.isSongPlaying(songRow.songId)) {
      this.playerState.pause();
      return;
    }

    this.playerState.playSong(storedSong);
  }

  playRelatedAlbum(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    const firstSong = this.songsCatalog().find(song => song.albumId === albumId);
    if (!firstSong) return;

    if (this.isRelatedAlbumPlaying(albumId)) {
      this.playerState.pause();
      return;
    }

    this.playerState.playSong(firstSong);
  }

  isAlbumPlaying(): boolean {
    const currentSong = this.playerState.currentSong();
    return !!currentSong && currentSong.albumId === this.albumId() && this.playerState.isPlaying();
  }

  isSongPlaying(songId: string): boolean {
    const currentSong = this.playerState.currentSong();
    return !!currentSong && currentSong.id === songId && this.playerState.isPlaying();
  }

  isRelatedAlbumPlaying(albumId: string): boolean {
    const currentSong = this.playerState.currentSong();
    return !!currentSong && currentSong.albumId === albumId && this.playerState.isPlaying();
  }

  /* ===================== */
  /* LIBRARY */
  /* ===================== */
  toggleSaveAlbum(): void {
    const user = this.currentUser();
    const album = this.currentAlbum();

    if (!user?.id || !album?.id) return;

    if (this.isAlbumSaved()) {
      const updated = this.userLibrary().filter(
        item =>
          !(
            item.userId === user.id &&
            item.itemType === 'ALBUM' &&
            item.itemId === album.id
          )
      );

      this.persistUserLibrary(updated);
      return;
    }

    const newItem: LibraryItem = {
      id: crypto.randomUUID(),
      userId: user.id,
      itemType: 'ALBUM',
      itemId: album.id,
      addedAt: new Date().toISOString(),
    };

    this.persistUserLibrary([...this.userLibrary(), newItem]);
  }

  isRelatedAlbumSaved(albumId: string): boolean {
    const user = this.currentUser();
    if (!user?.id || !albumId) return false;

    return this.userLibrary().some(
      item =>
        item.userId === user.id &&
        item.itemType === 'ALBUM' &&
        item.itemId === albumId
    );
  }

  toggleSaveRelatedAlbum(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    const user = this.currentUser();
    if (!user?.id || !albumId) return;

    if (this.isRelatedAlbumSaved(albumId)) {
      const updated = this.userLibrary().filter(
        item =>
          !(
            item.userId === user.id &&
            item.itemType === 'ALBUM' &&
            item.itemId === albumId
          )
      );

      this.persistUserLibrary(updated);
      this.closeRelatedAlbumMenu();
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
    this.closeRelatedAlbumMenu();
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
    this.closeRelatedAlbumMenu();
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
  /* RELATED ALBUM MENU */
  /* ===================== */
  toggleRelatedAlbumMenu(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (this.openRelatedAlbumMenuId() === albumId) {
      this.openRelatedAlbumMenuId.set(null);
      this.openRelatedAlbumPlaylistSubmenuId.set(null);
      return;
    }

    this.openRelatedAlbumMenuId.set(albumId);
    this.openRelatedAlbumPlaylistSubmenuId.set(null);
    this.closeSongMenu();
  }

  toggleRelatedAlbumPlaylistSubmenu(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (this.openRelatedAlbumPlaylistSubmenuId() === albumId) {
      this.openRelatedAlbumPlaylistSubmenuId.set(null);
      return;
    }

    this.openRelatedAlbumPlaylistSubmenuId.set(albumId);
  }

  closeRelatedAlbumMenu(): void {
    this.openRelatedAlbumMenuId.set(null);
    this.openRelatedAlbumPlaylistSubmenuId.set(null);
  }

  /* ===================== */
  /* LIKED SONGS */
  /* ===================== */
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

  /* ===================== */
  /* PLAYLISTS */
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

  addRelatedAlbumToNewPlaylist(albumId: string): void {
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

    this.closeRelatedAlbumMenu();
  }

  addRelatedAlbumToExistingPlaylist(playlistId: string, albumId: string, event?: MouseEvent): void {
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

    this.closeRelatedAlbumMenu();
  }

  /* ===================== */
  /* NAVIGATION */
  /* ===================== */
  goToArtist(): void {
    const artist = this.currentArtist();
    if (!artist?.id) return;

    this.router.navigate(['/user/artist', artist.id]);
  }

  goToArtistFromSong(song: AlbumSongRow, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!song.artistId) return;

    this.closeSongMenu();
    this.router.navigate(['/user/artist', song.artistId]);
  }

  goToSongDetail(song: AlbumSongRow, event?: MouseEvent): void {
    event?.stopPropagation();
    this.router.navigate(['/user/song', song.songId]);
  }

  goToAlbumDetail(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!albumId) return;

    this.closeRelatedAlbumMenu();
    this.router.navigate(['/user/album', albumId]);
  }

  /* ===================== */
  /* HELPERS */
  /* ===================== */
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeSongMenu();
    this.closeRelatedAlbumMenu();
  }

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

  private formatDuration(totalSeconds: number): string {
    const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
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