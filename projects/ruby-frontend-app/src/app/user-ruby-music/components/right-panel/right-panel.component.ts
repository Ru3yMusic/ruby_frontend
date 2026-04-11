import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Playlist } from '../../models/playlist.model';
import { PlayerState } from '../../state/player.state';
import { PlaylistState } from '../../state/playlist.state';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';

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

interface RelatedSongCard {
  id: string;
  songId: string;
  title: string;
  artistId: string;
  artistName: string;
  albumId: string | null;
  albumTitle: string;
  coverUrl: string;
  genreId: string;
  isLiked: boolean;
}

@Component({
  selector: 'app-right-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './right-panel.component.html',
  styleUrls: ['./right-panel.component.scss'],
})
export class RightPanelComponent {
  private readonly router = inject(Router);
  private readonly authState = inject(AuthState);
  private readonly playerState = inject(PlayerState);
  private readonly playlistState = inject(PlaylistState);

  private readonly ARTISTS_KEY = 'ruby_artists';
  private readonly ALBUMS_KEY = 'ruby_albums';
  private readonly SONGS_KEY = 'ruby_songs';
  private readonly USER_LIBRARY_KEY = 'ruby_user_library';

  private readonly defaultCover = '/assets/icons/playlist-cover-placeholder.png';
  private readonly defaultArtistPhoto = '/assets/icons/avatar-placeholder.png';

  readonly currentUser = this.authState.currentUser;
  readonly currentSong = this.playerState.currentSong;
  readonly isPlaying = this.playerState.isPlaying;

  readonly relatedCarouselIndex = signal(0);
  readonly isArtistBioModalOpen = signal(false);

  readonly artistsCatalog = signal<StoredArtist[]>(this.loadStorageArray<StoredArtist>(this.ARTISTS_KEY));
  readonly albumsCatalog = signal<StoredAlbum[]>(this.loadStorageArray<StoredAlbum>(this.ALBUMS_KEY));
  readonly songsCatalog = signal<StoredSong[]>(this.loadStorageArray<StoredSong>(this.SONGS_KEY));
  readonly userLibrary = signal<LibraryItem[]>(this.loadStorageArray<LibraryItem>(this.USER_LIBRARY_KEY));

  readonly customPlaylists = computed<Playlist[]>(() => {
    const user = this.currentUser();
    if (!user?.id) return [];

    return this.playlistState.getCustomPlaylistsByUser(user.id);
  });

  readonly displaySongTitle = computed(() => {
    return this.currentSong()?.title ?? 'Sin reproducción';
  });

  readonly displaySongCover = computed(() => {
    return this.currentSong()?.coverUrl || this.defaultCover;
  });

  readonly currentArtist = computed<StoredArtist | null>(() => {
    const song = this.currentSong();
    if (!song) return null;

    return this.artistsCatalog().find(artist => artist.id === song.artistId) ?? null;
  });

  readonly currentAlbum = computed<StoredAlbum | null>(() => {
    const song = this.currentSong();
    if (!song?.albumId) return null;

    return this.albumsCatalog().find(album => album.id === song.albumId) ?? null;
  });

  readonly displayArtistName = computed(() => {
    return this.currentArtist()?.name ?? 'Artista desconocido';
  });

  readonly displayArtistPhoto = computed(() => {
    return this.currentArtist()?.photoUrl || this.defaultArtistPhoto;
  });

  readonly displayArtistBioPreview = computed(() => {
    const bio = this.currentArtist()?.bio?.trim() ?? '';
    if (!bio) return 'Este artista todavía no tiene una biografía disponible.';

    if (bio.length <= 160) return bio;
    return `${bio.slice(0, 160).trim()}...`;
  });

  readonly displayArtistMonthlyListeners = computed(() => {
    const raw = this.currentArtist()?.monthlyListeners ?? '0';
    const value = Number(raw) || 0;

    return `${this.formatNumber(value)} oyentes mensuales`;
  });

  readonly relatedSongs = computed<RelatedSongCard[]>(() => {
    const song = this.currentSong();
    const user = this.currentUser();

    if (!song?.genreId) return [];

    const likedPlaylist = user?.id
      ? this.playlistState.getLikedSongsPlaylist(user.id) ?? this.playlistState.ensureLikedSongsPlaylist(user.id)
      : undefined;

    return this.songsCatalog()
      .filter(item => item.genreId === song.genreId && item.id !== song.id)
      .sort((a, b) => {
        const diff = (b.playCount ?? 0) - (a.playCount ?? 0);
        if (diff !== 0) return diff;

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 12)
      .map(item => {
        const artist = this.artistsCatalog().find(artistItem => artistItem.id === item.artistId);
        const album = item.albumId
          ? this.albumsCatalog().find(albumItem => albumItem.id === item.albumId)
          : null;

        return {
          id: `related-${item.id}`,
          songId: item.id,
          title: item.title,
          artistId: item.artistId,
          artistName: artist?.name ?? 'Artista desconocido',
          albumId: item.albumId,
          albumTitle: album?.title ?? 'Sencillo',
          coverUrl: item.coverUrl || this.defaultCover,
          genreId: item.genreId,
          isLiked: likedPlaylist?.songIds.includes(item.id) ?? false,
        };
      });
  });

  readonly visibleRelatedSongs = computed<RelatedSongCard[]>(() => {
    const start = this.relatedCarouselIndex();
    return this.relatedSongs().slice(start, start + 7);
  });

  readonly canMoveRelatedLeft = computed(() => this.relatedCarouselIndex() > 0);

  readonly canMoveRelatedRight = computed(() => {
    const songs = this.relatedSongs();
    return this.relatedCarouselIndex() + 7 < songs.length;
  });

  readonly isCurrentSongLiked = computed(() => {
    const song = this.currentSong();
    if (!song?.id) return false;

    return this.isSongLiked(song.id);
  });

  readonly isCurrentArtistFollowed = computed(() => {
    const artist = this.currentArtist();
    if (!artist?.id) return false;

    return this.isArtistFollowed(artist.id);
  });

  /* ===================== */
  /* RELATED CAROUSEL */
  /* ===================== */
  moveRelatedLeft(): void {
    if (!this.canMoveRelatedLeft()) return;
    this.relatedCarouselIndex.update(value => Math.max(0, value - 1));
  }

  moveRelatedRight(): void {
    if (!this.canMoveRelatedRight()) return;
    this.relatedCarouselIndex.update(value => value + 1);
  }

  /* ===================== */
  /* PLAYBACK */
  /* ===================== */
  playRelatedSong(songId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    const storedSong = this.songsCatalog().find(song => song.id === songId);
    if (!storedSong) return;

    if (this.isSongPlaying(songId)) {
      this.playerState.pause();
      return;
    }

    this.playerState.playSong(storedSong);
    this.relatedCarouselIndex.set(0);
  }

  isSongPlaying(songId: string): boolean {
    const currentSong = this.currentSong();
    return !!currentSong && currentSong.id === songId && this.isPlaying();
  }

  /* ===================== */
  /* LIKES */
  /* ===================== */
  isSongLiked(songId: string): boolean {
    const user = this.currentUser();
    if (!user?.id) return false;

    const likedPlaylist = this.playlistState.getLikedSongsPlaylist(user.id)
      ?? this.playlistState.ensureLikedSongsPlaylist(user.id);

    return likedPlaylist.songIds.includes(songId);
  }

  toggleCurrentSongLike(): void {
    const song = this.currentSong();
    const user = this.currentUser();

    if (!song?.id || !user?.id) return;

    if (this.isSongLiked(song.id)) {
      this.playlistState.removeSongFromLikedSongs(user.id, song.id);
      return;
    }

    this.playlistState.addSongToLikedSongs(user.id, song.id);
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

  toggleCurrentArtistFollow(): void {
    const user = this.currentUser();
    const artist = this.currentArtist();

    if (!user?.id || !artist?.id) return;

    if (this.isArtistFollowed(artist.id)) {
      const updated = this.userLibrary().filter(
        item =>
          !(
            item.userId === user.id &&
            item.itemType === 'ARTIST' &&
            item.itemId === artist.id
          )
      );

      this.persistUserLibrary(updated);
      return;
    }

    const newItem: LibraryItem = {
      id: crypto.randomUUID(),
      userId: user.id,
      itemType: 'ARTIST',
      itemId: artist.id,
      addedAt: new Date().toISOString(),
    };

    this.persistUserLibrary([...this.userLibrary(), newItem]);
  }

  /* ===================== */
  /* MODAL BIO */
  /* ===================== */
  openArtistBioModal(): void {
    if (!this.currentArtist()?.id) return;
    this.isArtistBioModalOpen.set(true);
  }

  closeArtistBioModal(): void {
    this.isArtistBioModalOpen.set(false);
  }

  /* ===================== */
  /* NAVIGATION */
  /* ===================== */
  goToCurrentArtist(event?: MouseEvent): void {
    event?.stopPropagation();

    const artist = this.currentArtist();
    if (!artist?.id) return;

    this.router.navigate(['/user/artist', artist.id]);
  }

  goToSongDetail(songId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.router.navigate(['/user/song', songId]);
  }

  goToRelatedArtist(artistId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!artistId) return;

    this.router.navigate(['/user/artist', artistId]);
  }

  /* ===================== */
  /* HELPERS */
  /* ===================== */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeArtistBioModal();
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

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }
}