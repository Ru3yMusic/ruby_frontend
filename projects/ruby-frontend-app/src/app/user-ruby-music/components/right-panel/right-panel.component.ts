import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SongResponse, ArtistResponse, AlbumResponse } from 'lib-ruby-sdks/catalog-service';
import { PlaylistResponse } from 'lib-ruby-sdks/playlist-service';
import { PlayerState, PlayerSong } from '../../state/player.state';
import { PlaylistState } from '../../state/playlist.state';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { LibraryState } from '../../state/library.state';
import { InteractionState } from '../../state/interaction.state';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ImgFallbackDirective],
  templateUrl: './right-panel.component.html',
  styleUrls: ['./right-panel.component.scss'],
})
export class RightPanelComponent {
  private readonly router = inject(Router);
  private readonly authState = inject(AuthState);
  private readonly playerState = inject(PlayerState);
  private readonly playlistState = inject(PlaylistState);
  private readonly libraryState = inject(LibraryState);
  private readonly interactionState = inject(InteractionState);

  private readonly defaultCover = '/assets/icons/playlist-cover-placeholder.png';
  private readonly defaultArtistPhoto = '/assets/icons/avatar-placeholder.png';

  readonly currentUser = this.authState.currentUser;
  readonly currentSong = this.playerState.currentSong;
  readonly isPlaying = this.playerState.isPlaying;

  readonly relatedCarouselIndex = signal(0);
  readonly isArtistBioModalOpen = signal(false);

  readonly customPlaylists = computed<PlaylistResponse[]>(() => {
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

  readonly currentArtist = computed<ArtistResponse | null>(() => {
    const song = this.currentSong();
    if (!song) return null;
    // Si currentSong se construyó como PlayerSong trae artistId plano;
    // si entró como SongResponse cruda (cast as any) trae artist embebido.
    const embedded = (song as any).artist as ArtistResponse | undefined;
    const artistId = song.artistId || embedded?.id;
    if (!artistId) return embedded ?? null;
    return this.libraryState.artists().find((a: ArtistResponse) => a.id === artistId)
      ?? embedded
      ?? null;
  });

  readonly currentAlbum = computed<AlbumResponse | null>(() => {
    const song = this.currentSong();
    if (!song) return null;
    const embedded = (song as any).album as AlbumResponse | undefined;
    const albumId = song.albumId || embedded?.id;
    if (!albumId) return embedded ?? null;
    return this.libraryState.albums().find((a: AlbumResponse) => a.id === albumId)
      ?? embedded
      ?? null;
  });

  readonly displayArtistName = computed(() => {
    return this.currentArtist()?.name ?? 'Artista desconocido';
  });

  readonly displayArtistPhoto = computed(() => {
    return this.currentArtist()?.photoUrl || this.defaultArtistPhoto;
  });

  readonly displayArtistBioPreview = computed(() => {
    const bio = (this.currentArtist()?.bio ?? '').trim();
    if (!bio) return 'Este artista todavía no tiene una biografía disponible.';
    if (bio.length <= 160) return bio;
    return `${bio.slice(0, 160).trim()}...`;
  });

  readonly displayArtistMonthlyListeners = computed(() => {
    const raw = this.currentArtist()?.monthlyListeners ?? '0';
    const value = Number(raw) || 0;
    return `${this.formatNumber(value)} oyentes mensuales`;
  });

  private readonly artistsById = computed(() => {
    const map = new Map<string, ArtistResponse>();
    for (const artist of this.libraryState.artists()) {
      if (artist.id) map.set(artist.id, artist);
    }
    return map;
  });

  private readonly albumsById = computed(() => {
    const map = new Map<string, AlbumResponse>();
    for (const album of this.libraryState.albums()) {
      if (album.id) map.set(album.id, album);
    }
    return map;
  });

  private readonly songsByGenreSorted = computed(() => {
    const grouped = new Map<string, SongResponse[]>();
    for (const song of this.libraryState.songs()) {
      const genreId = song.genres?.[0]?.id;
      if (!genreId) continue;
      const bucket = grouped.get(genreId);
      if (bucket) {
        bucket.push(song);
      } else {
        grouped.set(genreId, [song]);
      }
    }

    for (const bucket of grouped.values()) {
      bucket.sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0));
    }
    return grouped;
  });

  readonly relatedSongs = computed<RelatedSongCard[]>(() => {
    const song = this.currentSong();
    if (!song?.genreId) return [];

    const artistsById = this.artistsById();
    const albumsById = this.albumsById();
    const genreSongs = this.songsByGenreSorted().get(song.genreId) ?? [];

    const result: RelatedSongCard[] = [];
    for (const s of genreSongs) {
      if (s.id === song.id) continue;

      const artist = artistsById.get(s.artist?.id ?? '');
      const album = s.album?.id ? albumsById.get(s.album.id) : null;

      result.push({
        id: `related-${s.id ?? ''}`,
        songId: s.id ?? '',
        title: s.title ?? '',
        artistId: s.artist?.id ?? '',
        artistName: artist?.name ?? 'Artista desconocido',
        albumId: s.album?.id ?? null,
        albumTitle: album?.title ?? 'Sencillo',
        coverUrl: s.coverUrl || this.defaultCover,
        genreId: s.genres?.[0]?.id ?? '',
        isLiked: this.interactionState.isSongLiked(s.id ?? ''),
      });

      if (result.length >= 10) break;
    }

    return result;
  });

  readonly visibleRelatedSongs = computed<RelatedSongCard[]>(() => {
    const start = this.relatedCarouselIndex();
    return this.relatedSongs().slice(start, start + 7);
  });

  readonly canMoveRelatedLeft = computed(() => this.relatedCarouselIndex() > 0);

  /**
   * Enabled whenever there's another item past the current index — same
   * relaxed rule used in Home so the carousel stops being locked out just
   * because the list is shorter than the visible window.
   */
  readonly canMoveRelatedRight = computed(() => {
    return this.relatedCarouselIndex() + 1 < this.relatedSongs().length;
  });

  readonly isCurrentSongLiked = computed(() => {
    const song = this.currentSong();
    if (!song?.id) return false;
    return this.interactionState.isSongLiked(song.id);
  });

  readonly isCurrentArtistFollowed = computed(() => {
    const artist = this.currentArtist();
    if (!artist?.id) return false;
    return this.interactionState.isArtistInLibrary(artist.id);
  });

  /* ===================== */
  /* RELATED CAROUSEL */
  /* ===================== */
  // stopPropagation keeps the click from ever reaching the related-song card
  // below — otherwise the card's click handler would open the song detail,
  // which gave users the impression the arrow click "wasn't registered".
  moveRelatedLeft(event?: Event): void {
    event?.stopPropagation();
    if (!this.canMoveRelatedLeft()) return;
    this.relatedCarouselIndex.update(v => Math.max(0, v - 1));
  }

  moveRelatedRight(event?: Event): void {
    event?.stopPropagation();
    if (!this.canMoveRelatedRight()) return;
    this.relatedCarouselIndex.update(v => v + 1);
  }

  /* ===================== */
  /* PLAYBACK */
  /* ===================== */
  playRelatedSong(songId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    const songRes = this.libraryState.songs().find((s: SongResponse) => s.id === songId);
    if (!songRes) return;

    if (this.isSongPlaying(songId)) {
      this.playerState.pause();
      return;
    }

    this.playerState.playSong(this.toPlayerSong(songRes));
    this.relatedCarouselIndex.set(0);
  }

  isSongPlaying(songId: string): boolean {
    const current = this.currentSong();
    return !!current && current.id === songId && this.isPlaying();
  }

  /** True cuando la canción dada es la current del PlayerState (independiente de pause). */
  isCurrentPlayerSong(songId: string): boolean {
    return this.currentSong()?.id === songId;
  }

  /* ===================== */
  /* LIKES */
  /* ===================== */
  isSongLiked(songId: string): boolean {
    return this.interactionState.isSongLiked(songId);
  }

  toggleCurrentSongLike(): void {
    const song = this.currentSong();
    if (!song?.id) return;
    this.interactionState.toggleLike(song.id);
  }

  /* ===================== */
  /* FOLLOW ARTIST */
  /* ===================== */
  isArtistFollowed(artistId: string): boolean {
    return this.interactionState.isArtistInLibrary(artistId);
  }

  toggleCurrentArtistFollow(): void {
    const artist = this.currentArtist();
    if (!artist?.id) return;

    if (this.interactionState.isArtistInLibrary(artist.id)) {
      this.interactionState.removeArtistFromLibrary(artist.id);
    } else {
      this.interactionState.addArtistToLibrary(artist.id);
    }
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

  private toPlayerSong(song: SongResponse): PlayerSong {
    return {
      id: song.id ?? '',
      title: song.title ?? '',
      artistId: song.artist?.id ?? '',
      artistName: song.artist?.name ?? '',
      albumId: song.album?.id ?? null,
      albumTitle: song.album?.title ?? null,
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

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }
}
