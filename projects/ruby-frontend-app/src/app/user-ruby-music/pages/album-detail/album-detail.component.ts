import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AlbumsApi, SongResponse } from 'lib-ruby-sdks/catalog-service';
import { PlaylistResponse } from 'lib-ruby-sdks/playlist-service';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { PlayerState } from '../../state/player.state';
import { PlaylistState } from '../../state/playlist.state';
import { LibraryState } from '../../state/library.state';
import { InteractionState } from '../../state/interaction.state';

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
  private readonly libraryState = inject(LibraryState);
  private readonly interactionState = inject(InteractionState);
  private readonly albumsApi = inject(AlbumsApi);
  private readonly destroyRef = inject(DestroyRef);

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

  private readonly _detailSongs = signal<SongResponse[]>([]);
  private readonly _detailLoading = signal(false);
  private readonly _detailError = signal<string | null>(null);
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly detailError = this._detailError.asReadonly();

  readonly currentAlbum = computed<any>(() => {
    const id = this.albumId();
    if (!id) return null;
    return (this.libraryState.albums() as any[]).find(album => album.id === id) ?? null;
  });

  readonly currentArtist = computed<any>(() => {
    const album = this.currentAlbum();
    if (!album) return null;
    const embeddedArtistId = album.artist?.id;
    if (!embeddedArtistId) return album.artist ?? null;
    return (this.libraryState.artists() as any[]).find(artist => artist.id === embeddedArtistId)
      ?? album.artist
      ?? null;
  });

  readonly albumSongs = computed<AlbumSongRow[]>(() => {
    const album = this.currentAlbum();
    if (!album) return [];

    return (this._detailSongs() as any[])
      .map((song, index) => {
        return {
          id: `${album.id}-${song.id}`,
          index: index + 1,
          songId: song.id,
          title: song.title,
          artistId: song.artist?.id ?? '',
          artistName: song.artist?.name ?? 'Artista desconocido',
          durationLabel: this.formatDuration(song.duration ?? 0),
          isLiked: this.interactionState.isSongLiked(song.id ?? ''),
        };
      });
  });

  readonly songsCount = computed(() => this.albumSongs().length);

  readonly totalDurationSeconds = computed(() => {
    return (this._detailSongs() as any[])
      .reduce((total: number, song: any) => total + (song.duration ?? 0), 0);
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
    const album = this.currentAlbum();
    if (!album?.id) return false;
    return this.interactionState.isAlbumInLibrary(album.id);
  });

  readonly albumGradient = computed(() => {
    const color = this.headerAccentColor();
    const soft = `color-mix(in srgb, ${color} 65%, #0d0d0d)`;
    return `linear-gradient(180deg, ${soft} 0%, ${soft} 32%, #131313 68%, #090909 100%)`;
  });

  readonly customPlaylists = computed<PlaylistResponse[]>(() => {
    const user = this.currentUser();
    if (!user?.id) return [];
    return this.playlistState.getCustomPlaylistsByUser(user.id);
  });

  readonly relatedAlbums = computed<RelatedAlbumCard[]>(() => {
    const currentAlbum = this.currentAlbum();
    if (!currentAlbum) return [];

    return (this.libraryState.albums() as any[])
      .filter(album => album.artist?.id === currentAlbum.artist?.id && album.id !== currentAlbum.id)
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
        this.loadAlbumSongs(nextAlbumId);
        this.ensureAlbumInCatalog(nextAlbumId);

        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

    // Reactivo: cuando currentAlbum() se actualice (tras cargar catálogo o
    // detail del álbum) dispara el cálculo del color sin depender del timing
    // del paramMap subscribe.
    effect(() => {
      const album = this.currentAlbum();
      const url = album?.coverUrl ?? null;
      if (url) {
        this.updateAccentFromImage(url);
      } else {
        this.headerAccentColor.set(this.defaultTopColor);
      }
    });
  }

  /**
   * Refresh-safety net: if the global albums catalog doesn't contain this
   * album (direct F5 into /user/album/:id, or paginated catalog that didn't
   * include it), fetch by id and upsert so `currentAlbum` resolves. Usually
   * a no-op after the layout's global preload finishes.
   */
  private ensureAlbumInCatalog(albumId: string): void {
    if (!albumId) return;
    if (this.libraryState.albums().some((a: any) => a.id === albumId)) return;
    this.albumsApi.getAlbumById(albumId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (album) => this.libraryState.upsertAlbum(album),
        error: () => { /* silent — UI has defaults for the missing case */ },
      });
  }

  /* ===================== */
  /* INIT */
  /* ===================== */
  private loadAlbumSongs(albumId: string): void {
    if (!albumId) {
      this._detailSongs.set([]);
      return;
    }
    this._detailLoading.set(true);
    this._detailError.set(null);
    this.libraryState.getAlbumSongs(albumId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (songs) => {
          this._detailSongs.set(songs);
          this._detailLoading.set(false);
        },
        error: (err: { message?: string }) => {
          this._detailError.set(err?.message ?? 'Error al cargar canciones del álbum');
          this._detailLoading.set(false);
        },
      });
  }

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
    if (this.isAlbumPlaying()) {
      this.playerState.pause();
      return;
    }
    const queue = this.buildAlbumPlayerQueue();
    if (queue.length === 0) return;
    this.playerState.playQueue(queue as any, 0);
  }

  playSong(songRow: AlbumSongRow): void {
    if (this.isSongPlaying(songRow.songId)) {
      this.playerState.pause();
      return;
    }
    const queue = this.buildAlbumPlayerQueue();
    const idx = queue.findIndex((s: any) => s.id === songRow.songId);
    if (idx < 0) return;
    this.playerState.playQueue(queue as any, idx);
  }

  playRelatedAlbum(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();

    if (this.isRelatedAlbumPlaying(albumId)) {
      this.playerState.pause();
      return;
    }
    // Pull the whole album tracklist from catalog-service (same pattern as
    // Library / Home / Artist Detail) so the queue is complete regardless of
    // what happens to be cached in LibraryState at click time.
    this.libraryState.getAlbumSongs(albumId).subscribe(albumSongs => {
      if (albumSongs.length === 0) return;
      this.playerState.playQueue(albumSongs as any, 0);
    });
  }

  /**
   * Queue = the raw SongResponse list fetched for this album (_detailSongs).
   * We used to iterate the view-model rows and re-resolve each id against
   * LibraryState, but that indirection occasionally dropped entries when the
   * global songs signal hadn't cached them yet → queue of length 1 → footer
   * prev/next stuck disabled. `_detailSongs` is the authoritative source so
   * we just hand it over directly.
   */
  private buildAlbumPlayerQueue(): any[] {
    return (this._detailSongs() as any[]).slice();
  }

  isAlbumPlaying(): boolean {
    const currentSong = this.playerState.currentSong();
    if (!currentSong || !this.playerState.isPlaying()) return false;
    // Compare by song-id against this album's song list. PlayerSong doesn't
    // carry albumId, so the old (currentSong.albumId === albumId) check was
    // always false. Same pattern playlist-detail uses for its main button.
    return this.albumSongs().some(row => row.songId === currentSong.id);
  }

  isSongPlaying(songId: string): boolean {
    const currentSong = this.playerState.currentSong();
    return !!currentSong && (currentSong as any).id === songId && this.playerState.isPlaying();
  }

  /** True cuando la canción dada es la current del PlayerState (independiente de pause). */
  isCurrentPlayerSong(songId: string): boolean {
    return this.playerState.currentSong()?.id === songId;
  }

  isRelatedAlbumPlaying(albumId: string): boolean {
    const currentSong = this.playerState.currentSong();
    if (!currentSong || !this.playerState.isPlaying()) return false;
    // Cross-check the currently playing song against the related album's
    // tracks in LibraryState. Robust even if PlayerSong strips the nested
    // album reference.
    const relatedSongIds = new Set(
      (this.libraryState.songs() as any[])
        .filter(song => song.album?.id === albumId)
        .map(song => song.id),
    );
    return relatedSongIds.has(currentSong.id);
  }

  /* ===================== */
  /* LIBRARY */
  /* ===================== */
  toggleSaveAlbum(): void {
    const album = this.currentAlbum();
    if (!album?.id) return;

    if (this.isAlbumSaved()) {
      this.interactionState.removeAlbumFromLibrary(album.id);
      return;
    }

    this.interactionState.addAlbumToLibrary(album.id);
  }

  isRelatedAlbumSaved(albumId: string): boolean {
    return this.interactionState.isAlbumInLibrary(albumId);
  }

  toggleSaveRelatedAlbum(albumId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!albumId) return;

    if (this.isRelatedAlbumSaved(albumId)) {
      this.interactionState.removeAlbumFromLibrary(albumId);
      this.closeRelatedAlbumMenu();
      return;
    }

    this.interactionState.addAlbumToLibrary(albumId);
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
  /* PLAYLISTS */
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

  addRelatedAlbumToNewPlaylist(albumId: string): void {
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
            this.closeRelatedAlbumMenu();
          });
      }
    );
  }

  addRelatedAlbumToExistingPlaylist(playlistId: string, albumId: string, event?: MouseEvent): void {
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

        this.closeRelatedAlbumMenu();
      });
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
