import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ArtistsApi, SongResponse } from 'lib-ruby-sdks/catalog-service';
import { PlaylistResponse } from 'lib-ruby-sdks/playlist-service';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { PlayerState } from '../../state/player.state';
import { PlaylistState } from '../../state/playlist.state';
import { LibraryState } from '../../state/library.state';
import { InteractionState } from '../../state/interaction.state';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';

interface PopularSongRow {
  id: string;
  index: number;
  songId: string;
  title: string;
  artistId: string;
  artistName: string;
  albumId: string | null;
  albumTitle: string;
  coverUrl: string;
  playCount: number;
  playCountLabel: string;
  durationLabel: string;
  isLiked: boolean;
}

interface ArtistAlbumCard {
  id: string;
  title: string;
  coverUrl: string;
  releaseYear: string;
}

interface RelatedArtistCard {
  id: string;
  name: string;
  photoUrl: string;
}

@Component({
  selector: 'app-artist-detail',
  standalone: true,
  imports: [CommonModule, ImgFallbackDirective],
  templateUrl: './artist-detail.component.html',
  styleUrls: ['./artist-detail.component.scss'],
})
export class ArtistDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authState = inject(AuthState);
  private readonly playlistState = inject(PlaylistState);
  private readonly playerState = inject(PlayerState);
  private readonly libraryState = inject(LibraryState);
  private readonly interactionState = inject(InteractionState);
  private readonly artistsApi = inject(ArtistsApi);
  private readonly destroyRef = inject(DestroyRef);

  private readonly defaultTopColor = '#242424';
  private readonly defaultArtistPhoto = '/assets/icons/avatar-placeholder.png';
  private readonly defaultAlbumCover = '/assets/icons/playlist-cover-placeholder.png';

  readonly currentUser = this.authState.currentUser;
  readonly artistId = signal(this.route.snapshot.paramMap.get('id') ?? '');

  readonly showAllPopularSongs = signal(false);
  readonly isArtistMenuOpen = signal(false);

  readonly openSongMenuId = signal<string | null>(null);
  readonly openPlaylistSubmenuSongId = signal<string | null>(null);

  readonly openAlbumMenuId = signal<string | null>(null);
  readonly openAlbumPlaylistSubmenuId = signal<string | null>(null);

  readonly openRelatedArtistMenuId = signal<string | null>(null);

  readonly headerAccentColor = signal(this.defaultTopColor);

  private readonly _detailSongs = signal<SongResponse[]>([]);
  private readonly _detailLoading = signal(false);
  private readonly _detailError = signal<string | null>(null);
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly detailError = this._detailError.asReadonly();

  readonly currentArtist = computed<any>(() => {
    const id = this.artistId();
    if (!id) return null;
    return (this.libraryState.artists() as any[]).find(artist => artist.id === id) ?? null;
  });

  readonly displayArtistName = computed(() => {
    return this.currentArtist()?.name ?? 'Artista';
  });

  readonly displayArtistPhoto = computed(() => {
    return this.currentArtist()?.photoUrl || this.defaultArtistPhoto;
  });

  readonly monthlyListenersLabel = computed(() => {
    const raw = this.currentArtist()?.monthlyListeners ?? '0';
    const value = Number(raw) || 0;
    return `${this.formatNumber(value)} oyentes mensuales`;
  });

  readonly artistGradient = computed(() => {
    const color = this.headerAccentColor();
    const soft = `color-mix(in srgb, ${color} 65%, #0d0d0d)`;
    return `linear-gradient(180deg, ${soft} 0%, ${soft} 28%, #141414 62%, #090909 100%)`;
  });

  readonly allArtistSongs = computed<any[]>(() => {
    return (this._detailSongs() as any[])
      .slice()
      .sort((a, b) => {
        const diff = (b.playCount ?? 0) - (a.playCount ?? 0);
        if (diff !== 0) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 10);
  });

  readonly popularSongs = computed<PopularSongRow[]>(() => {
    const user = this.currentUser();
    const songs = this.allArtistSongs();

    return songs.map((song, index) => {
      const embeddedAlbumId = song.album?.id ?? null;
      const album = embeddedAlbumId
        ? (song.album
          ?? (this.libraryState.albums() as any[]).find(item => item.id === embeddedAlbumId))
        : null;
      const artistId = song.artist?.id ?? '';

      return {
        id: `${artistId}-${song.id}`,
        index: index + 1,
        songId: song.id,
        title: song.title,
        artistId,
        artistName: song.artist?.name ?? this.displayArtistName(),
        albumId: embeddedAlbumId,
        albumTitle: (album as any)?.title ?? 'Sencillo',
        coverUrl: song.coverUrl || this.defaultAlbumCover,
        playCount: song.playCount ?? 0,
        playCountLabel: this.formatNumber(song.playCount ?? 0),
        durationLabel: this.formatDuration(song.duration ?? 0),
        isLiked: this.interactionState.isSongLiked(song.id ?? ''),
      };
    });
  });

  readonly visiblePopularSongs = computed<PopularSongRow[]>(() => {
    const songs = this.popularSongs();
    return this.showAllPopularSongs() ? songs : songs.slice(0, 5);
  });

  readonly canTogglePopularSongs = computed(() => this.popularSongs().length > 5);
  readonly hasArtistSongs = computed(() => this.popularSongs().length > 0);

  readonly artistAlbums = computed<ArtistAlbumCard[]>(() => {
    const artist = this.currentArtist();
    if (!artist) return [];

    return (this.libraryState.albums() as any[])
      .filter(album => album.artist?.id === artist.id)
      .sort((a, b) => new Date(b.releaseDateTime || b.createdAt).getTime() - new Date(a.releaseDateTime || a.createdAt).getTime())
      .map(album => ({
        id: album.id,
        title: album.title,
        coverUrl: album.coverUrl || this.defaultAlbumCover,
        releaseYear: this.extractYear(album.releaseDateTime || album.createdAt),
      }));
  });

  readonly hasArtistAlbums = computed(() => this.artistAlbums().length > 0);

  readonly relatedArtists = computed<RelatedArtistCard[]>(() => {
    const currentArtist = this.currentArtist();
    if (!currentArtist) return [];

    return (this.libraryState.artists() as any[])
      .filter(artist => artist.id !== currentArtist.id)
      .slice(0, 6)
      .map(artist => ({
        id: artist.id,
        name: artist.name,
        photoUrl: artist.photoUrl || this.defaultArtistPhoto,
      }));
  });

  readonly hasRelatedArtists = computed(() => this.relatedArtists().length > 0);

  readonly customPlaylists = computed<PlaylistResponse[]>(() => {
    const user = this.currentUser();
    if (!user?.id) return [];
    return this.playlistState.getCustomPlaylistsByUser(user.id);
  });

  readonly isArtistFollowed = computed(() => {
    const artist = this.currentArtist();
    if (!artist?.id) return false;
    return this.interactionState.isArtistFollowed(artist.id);
  });

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(paramMap => {
        const nextArtistId = paramMap.get('id') ?? '';

        this.artistId.set(nextArtistId);
        this.showAllPopularSongs.set(false);
        this.isArtistMenuOpen.set(false);
        this.closeSongMenu();
        this.closeAlbumMenu();
        this.closeRelatedArtistMenu();
        this.bootstrapArtistDetail();
        this.loadArtistSongs(nextArtistId);
        this.interactionState.loadFollowedArtists();
        this.ensureArtistInCatalog(nextArtistId);

        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

    // Reactivo: cuando currentArtist() se actualice (tras cargar catálogo)
    // dispara el cálculo del color sin depender del timing del paramMap.
    effect(() => {
      const artist = this.currentArtist();
      const url = artist?.photoUrl ?? null;
      if (url) {
        this.updateAccentFromImage(url);
      } else {
        this.headerAccentColor.set(this.defaultTopColor);
      }
    });
  }

  /**
   * Targeted refresh-safety net: if the global artists/albums catalog doesn't
   * contain this artist (fresh page load, paginated catalog, etc.), hit the
   * catalog-service by id and upsert. After the layout's global preload this
   * is usually a no-op, but it guarantees correctness regardless of the page
   * the user refreshed on.
   */
  private ensureArtistInCatalog(artistId: string): void {
    if (!artistId) return;
    const alreadyHaveArtist = this.libraryState.artists().some((a: any) => a.id === artistId);
    if (!alreadyHaveArtist) {
      this.artistsApi.getArtistById(artistId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (artist) => this.libraryState.upsertArtist(artist),
          error: () => { /* silent — existing UI fallbacks handle the empty case */ },
        });
    }
    const alreadyHaveAlbums = this.libraryState.albums().some((a: any) => a.artist?.id === artistId);
    if (!alreadyHaveAlbums) {
      this.artistsApi.getArtistAlbums(artistId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (page) => this.libraryState.upsertAlbums(page.content ?? []),
          error: () => { /* silent */ },
        });
    }
  }

  /* ===================== */
  /* INIT */
  /* ===================== */
  private loadArtistSongs(artistId: string): void {
    if (!artistId) {
      this._detailSongs.set([]);
      return;
    }
    this._detailLoading.set(true);
    this._detailError.set(null);
    this.libraryState.getArtistSongs(artistId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (songs) => {
          this._detailSongs.set(songs);
          this._detailLoading.set(false);
        },
        error: (err: { message?: string }) => {
          this._detailError.set(err?.message ?? 'Error al cargar canciones del artista');
          this._detailLoading.set(false);
        },
      });
  }

  private bootstrapArtistDetail(): void {
    const artist = this.currentArtist();

    if (!artist) {
      this.headerAccentColor.set(this.defaultTopColor);
      return;
    }

    if (artist.photoUrl) {
      this.updateAccentFromImage(artist.photoUrl);
    } else {
      this.headerAccentColor.set(this.defaultTopColor);
    }
  }

  /* ===================== */
  /* FOLLOW / LIBRARY */
  /* ===================== */
  toggleFollowArtist(): void {
    const artist = this.currentArtist();
    if (!artist?.id) return;

    if (this.isArtistFollowed()) {
      this.interactionState.unfollowArtist(artist.id);
      this.isArtistMenuOpen.set(false);
      return;
    }

    this.interactionState.followArtist(artist.id);
    this.isArtistMenuOpen.set(false);
  }

  isRelatedArtistFollowed(artistId: string): boolean {
    return this.interactionState.isArtistFollowed(artistId);
  }

  toggleFollowRelatedArtist(artistId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!artistId) return;

    if (this.isRelatedArtistFollowed(artistId)) {
      this.interactionState.unfollowArtist(artistId);
      this.closeRelatedArtistMenu();
      return;
    }

    this.interactionState.followArtist(artistId);
    this.closeRelatedArtistMenu();
  }

  /* ===================== */
  /* ARTIST MENU */
  /* ===================== */
  toggleArtistMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isArtistMenuOpen.set(!this.isArtistMenuOpen());
    this.closeSongMenu();
    this.closeAlbumMenu();
    this.closeRelatedArtistMenu();
  }

  closeArtistMenu(): void {
    this.isArtistMenuOpen.set(false);
  }

  /* ===================== */
  /* PLAYBACK */
  /* ===================== */
  playArtist(): void {
    if (this.isArtistPlaying()) {
      this.playerState.pause();
      return;
    }
    const queue = this.buildArtistPopularQueue();
    if (queue.length === 0) return;
    this.playerState.playQueue(queue as any, 0);
  }

  playSong(songRow: PopularSongRow): void {
    if (this.isSongPlaying(songRow.songId)) {
      this.playerState.pause();
      return;
    }
    const queue = this.buildArtistPopularQueue();
    const idx = queue.findIndex((s: any) => s.id === songRow.songId);
    if (idx < 0) return;
    this.playerState.playQueue(queue as any, idx);
  }

  playAlbum(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (this.isAlbumPlaying(albumId)) {
      this.playerState.pause();
      return;
    }
    // Hit the album-songs endpoint (same source album-detail and Library use)
    // so the queue is always the album's full tracklist. The previous version
    // filtered `libraryState.songs()` — the global "recent songs" signal —
    // which only contained a subset of tracks for older artists (e.g. 2Pac):
    // queue came back with 1 item and footer prev/next stayed disabled.
    this.libraryState.getAlbumSongs(albumId).subscribe(albumSongs => {
      if (albumSongs.length === 0) return;
      this.playerState.playQueue(albumSongs as any, 0);
    });
  }

  playRelatedArtist(artistId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (this.isRelatedArtistPlaying(artistId)) {
      this.playerState.pause();
      return;
    }
    const queue = (this.libraryState.songs() as any[])
      .filter(song => song.artist?.id === artistId)
      .sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0));
    if (queue.length === 0) return;
    this.playerState.playQueue(queue as any, 0);
  }

  /**
   * Resolves each popular-song row into its underlying SongResponse so the
   * whole "Popular" list becomes the playback queue — next/previous in the
   * footer will move through the artist's tracks.
   */
  private buildArtistPopularQueue(): any[] {
    const detail = this._detailSongs() as any[];
    const library = this.libraryState.songs() as any[];
    return this.popularSongs()
      .map(row => detail.find(s => s.id === row.songId)
        ?? library.find(s => s.id === row.songId))
      .filter((s): s is any => !!s);
  }

  isArtistPlaying(): boolean {
    const currentSong = this.playerState.currentSong();
    return !!currentSong && (currentSong as any).artistId === this.artistId() && this.playerState.isPlaying();
  }

  isSongPlaying(songId: string): boolean {
    const currentSong = this.playerState.currentSong();
    return !!currentSong && (currentSong as any).id === songId && this.playerState.isPlaying();
  }

  /** True cuando la canción dada es la current del PlayerState (independiente de pause). */
  isCurrentPlayerSong(songId: string): boolean {
    return this.playerState.currentSong()?.id === songId;
  }

  isAlbumPlaying(albumId: string): boolean {
    const currentSong = this.playerState.currentSong();
    if (!currentSong || !this.playerState.isPlaying()) return false;
    // PlayerSong now carries albumId (populated by PlayerState.normalizeInputSong
    // from the nested album.id). Comparing directly is reliable regardless of
    // what LibraryState happens to have cached — the old lookup missed older
    // artists whose tracks weren't in the "recent songs" signal.
    return currentSong.albumId === albumId;
  }

  isRelatedArtistPlaying(artistId: string): boolean {
    const currentSong = this.playerState.currentSong();
    return !!currentSong && (currentSong as any).artistId === artistId && this.playerState.isPlaying();
  }

  /* ===================== */
  /* POPULAR SONGS */
  /* ===================== */
  togglePopularSongsExpansion(): void {
    this.showAllPopularSongs.set(!this.showAllPopularSongs());
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
    this.closeArtistMenu();
    this.closeAlbumMenu();
    this.closeRelatedArtistMenu();
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
  /* LIKED SONGS */
  /* ===================== */
  isSongLiked(songId: string): boolean {
    return this.interactionState.isSongLiked(songId);
  }

  toggleSongLike(songId: string): void {
    if (this.interactionState.isSongLiked(songId)) {
      this.interactionState.unlikeSong(songId);
    } else {
      this.interactionState.likeSong(songId);
    }
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
      { name: `Mi playlist n.° ${nextNumber}`, description: null, isPublic: true },
      (created) => {
        this.playlistState.addSongToPlaylist(created.id!, songId);
        const storedSong = (this._detailSongs() as any[]).find(s => s.id === songId)
          ?? (this.libraryState.songs() as any[]).find(s => s.id === songId);
        if (storedSong?.coverUrl) {
          this.playlistState.updatePlaylist(created.id!, { coverUrl: storedSong.coverUrl });
        }
        this.closeSongMenu();
      }
    );
  }

  addSongToExistingPlaylist(playlistId: string, songId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (!playlistId || !songId) return;

    this.playlistState.addSongToPlaylist(playlistId, songId);

    const playlist = this.playlistState.playlists().find(item => item.id === playlistId);
    const storedSong = (this._detailSongs() as any[]).find(song => song.id === songId)
      ?? (this.libraryState.songs() as any[]).find(song => song.id === songId);

    if (playlist && !playlist.coverUrl && storedSong?.coverUrl) {
      this.playlistState.updatePlaylist(playlistId, { coverUrl: storedSong.coverUrl });
    }

    this.closeSongMenu();
  }

  /* ===================== */
  /* SONG NAVIGATION */
  /* ===================== */
  hasAlbum(song: PopularSongRow): boolean {
    return !!song.albumId;
  }

  goToAlbumFromSong(song: PopularSongRow, event?: MouseEvent): void {
    event?.stopPropagation();

    if (!song.albumId) return;

    this.closeSongMenu();
    this.router.navigate(['/user/album', song.albumId]);
  }

  /* ===================== */
  /* ARTIST ALBUMS */
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
    this.closeArtistMenu();
    this.closeSongMenu();
    this.closeRelatedArtistMenu();
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

  isArtistAlbumSaved(albumId: string): boolean {
    return this.interactionState.isAlbumInLibrary(albumId);
  }

  toggleSaveArtistAlbum(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!albumId) return;

    if (this.isArtistAlbumSaved(albumId)) {
      this.interactionState.removeAlbumFromLibrary(albumId);
      this.closeAlbumMenu();
      return;
    }

    this.interactionState.addAlbumToLibrary(albumId);
    this.closeAlbumMenu();
  }

  addArtistAlbumToNewPlaylist(albumId: string): void {
    const user = this.currentUser();
    if (!user?.id || !albumId) return;

    const nextNumber = this.playlistState.getCustomPlaylistsByUser(user.id).length + 1;

    this.playlistState.createPlaylist(
      { name: `Mi playlist n.° ${nextNumber}`, description: null, isPublic: true },
      (created) => {
        this.libraryState.getAlbumSongs(albumId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(albumSongs => {
            albumSongs.forEach(s => this.playlistState.addSongToPlaylist(created.id!, s.id!));
            const firstSong = albumSongs[0];
            if (firstSong?.coverUrl) {
              this.playlistState.updatePlaylist(created.id!, { coverUrl: firstSong.coverUrl });
            }
            this.closeAlbumMenu();
          });
      }
    );
  }

  addArtistAlbumToExistingPlaylist(playlistId: string, albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (!playlistId || !albumId) return;

    this.libraryState.getAlbumSongs(albumId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(albumSongs => {
        albumSongs.forEach(song => {
          this.playlistState.addSongToPlaylist(playlistId, song.id!);
        });

        const playlist = this.playlistState.playlists().find(item => item.id === playlistId);
        const firstSong = albumSongs[0];

        if (playlist && !playlist.coverUrl && firstSong?.coverUrl) {
          this.playlistState.updatePlaylist(playlistId, { coverUrl: firstSong.coverUrl });
        }

        this.closeAlbumMenu();
      });
  }

  goToAlbumDetail(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!albumId) return;

    this.closeAlbumMenu();
    this.router.navigate(['/user/album', albumId]);
  }

  /* ===================== */
  /* RELATED ARTISTS */
  /* ===================== */
  toggleRelatedArtistMenu(artistId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (this.openRelatedArtistMenuId() === artistId) {
      this.openRelatedArtistMenuId.set(null);
      return;
    }

    this.openRelatedArtistMenuId.set(artistId);
    this.closeArtistMenu();
    this.closeSongMenu();
    this.closeAlbumMenu();
  }

  closeRelatedArtistMenu(): void {
    this.openRelatedArtistMenuId.set(null);
  }

  goToArtistDetail(artistId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!artistId) return;

    this.closeRelatedArtistMenu();
    this.router.navigate(['/user/artist', artistId]);
  }

  /* ===================== */
  /* HELPERS */
  /* ===================== */
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeArtistMenu();
    this.closeSongMenu();
    this.closeAlbumMenu();
    this.closeRelatedArtistMenu();
  }

  private formatDuration(totalSeconds: number): string {
    const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  /** Spotify-style: dots as thousands separators (es-ES locale, e.g. 2.554.300). */
  private formatNumber(value: number): string {
    const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    return new Intl.NumberFormat('es-ES').format(safe);
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
        this.headerAccentColor.set(this.hashToAccent(imageUrl));
        return;
      }

      const sampleWidth = 64;
      const sampleHeight = 64;

      canvas.width = sampleWidth;
      canvas.height = sampleHeight;

      context.drawImage(image, 0, 0, sampleWidth, sampleHeight);

      let data: Uint8ClampedArray;
      try {
        data = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
      } catch {
        // Canvas tainted (CORS). Fallback a color derivado del URL.
        this.headerAccentColor.set(this.hashToAccent(imageUrl));
        return;
      }

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
        this.headerAccentColor.set(this.hashToAccent(imageUrl));
        return;
      }

      const avgRed = Math.round(red / total);
      const avgGreen = Math.round(green / total);
      const avgBlue = Math.round(blue / total);

      this.headerAccentColor.set(this.softenRgb(avgRed, avgGreen, avgBlue));
    };

    image.onerror = () => {
      // CORS bloqueado / 404 / red. Fallback a color derivado del URL.
      this.headerAccentColor.set(this.hashToAccent(imageUrl));
    };

    image.src = imageUrl;
  }

  private softenRgb(r: number, g: number, b: number): string {
    const soften = (value: number) => Math.min(255, Math.round(value * 0.7));
    return `rgb(${soften(r)}, ${soften(g)}, ${soften(b)})`;
  }

  /**
   * Color accent estable derivado por hash de la URL. Se usa cuando
   * updateAccentFromImage no puede extraer color real (CORS, load error).
   */
  private hashToAccent(url: string): string {
    if (!url) return this.defaultTopColor;
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      hash = (hash * 31 + url.charCodeAt(i)) | 0;
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 55%, 32%)`;
  }
}
