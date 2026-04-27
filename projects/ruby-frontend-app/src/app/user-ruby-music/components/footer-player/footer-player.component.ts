import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PlayerState } from '../../state/player.state';
import { LibraryState } from '../../state/library.state';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';

@Component({
  selector: 'app-footer-player',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ImgFallbackDirective],
  templateUrl: './footer-player.component.html',
  styleUrls: ['./footer-player.component.scss'],
})
export class FooterPlayerComponent implements AfterViewInit, OnDestroy {
  private readonly playerState = inject(PlayerState);
  private readonly router = inject(Router);
  private readonly libraryState = inject(LibraryState);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  private readonly defaultCover = '/assets/icons/playlist-cover-placeholder.png';

  @ViewChild('audioRef') audioRef?: ElementRef<HTMLAudioElement>;

  readonly currentSong = this.playerState.currentSong;
  readonly isPlaying = this.playerState.isPlaying;
  readonly currentTime = this.playerState.currentTime;
  readonly duration = this.playerState.duration;
  readonly volume = this.playerState.volume;
  readonly progressPercent = this.playerState.progressPercent;
  readonly hasSong = this.playerState.hasSong;
  readonly hasQueue = this.playerState.hasQueue;
  readonly isShuffle = this.playerState.isShuffle;
  readonly isRepeatOne = this.playerState.isRepeatOne;

  /**
   * Matches the live-station detail route `/user/station/:id` only — NOT the
   * station listing at `/user/station`. The footer must keep playing while the
   * user browses the listing; only when they enter a specific station (which
   * has its own audio element) should we pause + visually hide.
   */
  private static readonly LIVE_STATION_ROUTE_REGEX = /^\/user\/station\/[^/]+/;

  readonly isStationRoute = signal(
    FooterPlayerComponent.LIVE_STATION_ROUTE_REGEX.test(this.router.url),
  );

  /**
   * When PlayerState restores a snapshot from sessionStorage at bootstrap,
   * `currentTime()` is already at the saved offset but the <audio> element
   * hasn't been created yet — we can't seek it until it exists AND has loaded
   * its metadata. This one-shot value holds the restore target, applied once
   * on the first `loadedmetadata` and cleared so normal playback can mutate
   * currentTime freely afterwards.
   */
  private pendingSeekOnLoad: number | null = null;
  private lastTimeSyncAt = 0;
  private readonly timeSyncIntervalMs = 250;
  private syncedAudioUrl: string | null = null;
  private teardownAudioListeners: (() => void) | null = null;

  readonly displayCoverUrl = computed(() => {
    return this.currentSong()?.coverUrl || this.defaultCover;
  });

  readonly displayTitle = computed(() => {
    return this.currentSong()?.title || 'Sin reproducción';
  });

  readonly displayArtistName = computed(() => {
    const song = this.currentSong();
    if (!song) return 'Selecciona una canción';

    // The name is normalized into PlayerSong at play time (see
    // PlayerState.normalizeInputSong), so it's always present. Fall back to a
    // LibraryState lookup only if a legacy caller slipped in an unnormalized
    // song — shouldn't happen, but it's cheap insurance.
    if (song.artistName) return song.artistName;
    const artist = this.libraryState.artists().find(item => (item as any).id === song.artistId);
    return (artist as any)?.name ?? 'Artista desconocido';
  });

  readonly currentTimeLabel = computed(() => {
    return this.playerState.formatTime(this.currentTime());
  });

  readonly durationLabel = computed(() => {
    return this.playerState.formatTime(this.duration());
  });

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.isStationRoute.set(
          FooterPlayerComponent.LIVE_STATION_ROUTE_REGEX.test(event.urlAfterRedirects),
        );
      }
    });

    effect(() => {
      const song = this.currentSong();
      if (!song) return;
      if (this.isStationRoute()) return;

      this.syncAudioSource(song.audioUrl);
    });

    effect(() => {
      const volume = this.volume();
      const audio = this.audioRef?.nativeElement;
      if (!audio) return;

      audio.volume = volume;
    });

    effect(() => {
      const playing = this.isPlaying();
      const song = this.currentSong();
      if (!song) return;
      if (this.isStationRoute()) return;

      this.syncPlayback(playing);
    });

    // Cuando se entra a station-detail, pausar físicamente el <audio> del footer
    // para evitar que se cruce con el <audio> de station-detail. Los demás effects
    // ya están guard'eados con isStationRoute() — este effect cierra el caso del
    // audio que estaba sonando antes de entrar.
    effect(() => {
      if (!this.isStationRoute()) return;
      const audio = this.audioRef?.nativeElement;
      if (audio && !audio.paused) {
        audio.pause();
      }
    });
  }

  ngAfterViewInit(): void {
    const audio = this.audioRef?.nativeElement;
    if (!audio) return;

    this.attachAudioListeners(audio);

    audio.volume = this.volume();

    const song = this.currentSong();
    if (song && !this.isStationRoute()) {
      // If PlayerState restored with a non-zero currentTime (F5 mid-song),
      // stash it so onLoadedMetadata can seek the <audio> once it's ready.
      // Always stays paused — isPlaying was not restored.
      const restoredTime = this.currentTime();
      if (restoredTime > 0) {
        this.pendingSeekOnLoad = restoredTime;
      }

      this.syncAudioSource(song.audioUrl);

      if (this.isPlaying()) {
        this.syncPlayback(true);
      }
    }
  }

  togglePlayPause(): void {
    if (this.isStationRoute()) return;

    const audio = this.audioRef?.nativeElement;
    const song = this.currentSong();

    if (!audio || !song) return;

    if (audio.paused) {
      void audio.play()
        .then(() => {
          this.playerState.setPlaying(true);
        })
        .catch((error) => {
          console.error('Error reproduciendo audio:', error);
          this.playerState.setPlaying(false);
        });
      return;
    }

    audio.pause();
    this.playerState.setPlaying(false);
  }

  onTimeUpdate(): void {
    if (this.isStationRoute()) return;

    const audio = this.audioRef?.nativeElement;
    if (!audio) return;

    const now = Date.now();
    if (now - this.lastTimeSyncAt < this.timeSyncIntervalMs) return;
    this.lastTimeSyncAt = now;
    this.playerState.setCurrentTime(audio.currentTime);
  }

  ngOnDestroy(): void {
    this.teardownAudioListeners?.();
    this.teardownAudioListeners = null;
  }

  private attachAudioListeners(audio: HTMLAudioElement): void {
    this.teardownAudioListeners?.();

    this.ngZone.runOutsideAngular(() => {
      const onTimeUpdate = () => {
        if (this.isStationRoute()) return;

        const now = Date.now();
        if (now - this.lastTimeSyncAt < this.timeSyncIntervalMs) return;
        this.lastTimeSyncAt = now;
        const nextTime = audio.currentTime;

        this.ngZone.run(() => {
          this.playerState.setCurrentTime(nextTime);
        });
      };

      const onLoadedMetadata = () => {
        this.ngZone.run(() => this.onLoadedMetadata());
      };

      const onEnded = () => {
        this.ngZone.run(() => this.onEnded());
      };

      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('loadedmetadata', onLoadedMetadata);
      audio.addEventListener('ended', onEnded);

      this.teardownAudioListeners = () => {
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        audio.removeEventListener('ended', onEnded);
      };
    });
  }

  onLoadedMetadata(): void {
    if (this.isStationRoute()) return;

    const audio = this.audioRef?.nativeElement;
    if (!audio) return;

    this.playerState.setDuration(audio.duration || this.currentSong()?.durationSeconds || 0);

    // Apply the post-restore seek exactly once, then clear the flag so normal
    // song changes (which also fire loadedmetadata) don't get re-seeked.
    if (this.pendingSeekOnLoad !== null) {
      audio.currentTime = this.pendingSeekOnLoad;
      this.playerState.setCurrentTime(this.pendingSeekOnLoad);
      this.pendingSeekOnLoad = null;
    }
  }

  onEnded(): void {
    if (this.isStationRoute()) return;

    const audio = this.audioRef?.nativeElement;
    if (audio) audio.currentTime = 0;

    const wasRepeatOne = this.playerState.isRepeatOne();
    // Delegate to PlayerState: restarts the track under repeat-one, advances
    // the queue otherwise, or pauses at 0 when the queue is exhausted. The
    // effect on currentSong() re-syncs the <audio> src for a real queue jump.
    this.playerState.advanceOnEnded();

    // Under repeat-one the current song didn't change identity, so neither
    // the syncAudioSource nor the syncPlayback effect will re-fire (signals
    // were already at their target values). Kick the <audio> element manually.
    if (wasRepeatOne && audio) {
      void audio.play().catch((error) => {
        console.error('Error al reiniciar repetición:', error);
        this.playerState.setPlaying(false);
      });
    }
  }

  toggleShuffle(): void {
    this.playerState.toggleShuffle();
  }

  toggleRepeatOne(): void {
    this.playerState.toggleRepeatOne();
  }

  goToPreviousSong(): void {
    if (this.isStationRoute()) return;

    // Common player UX: if we're past ~3 s into the track, pressing Anterior
    // restarts the current song instead of jumping back — protects against
    // accidental double-clicks and matches Spotify-style behaviour.
    const audio = this.audioRef?.nativeElement;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      this.playerState.setCurrentTime(0);
      if (audio.paused) {
        void audio.play().catch(() => this.playerState.setPlaying(false));
      }
      return;
    }

    this.playerState.previous();
  }

  goToNextSong(): void {
    if (this.isStationRoute()) return;
    this.playerState.next();
  }

  onSeekInput(event: Event): void {
    if (this.isStationRoute()) return;

    const audio = this.audioRef?.nativeElement;
    if (!audio) return;

    const input = event.target as HTMLInputElement;
    const nextTime = Number(input.value);

    audio.currentTime = nextTime;
    this.playerState.setCurrentTime(nextTime);
  }

  onVolumeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const nextVolume = Number(input.value);

    this.playerState.setVolume(nextVolume);
  }

  private syncAudioSource(nextUrl: string): void {
    const audio = this.audioRef?.nativeElement;
    if (!audio || !nextUrl) return;

    const normalizedNextUrl = this.normalizeAudioUrl(nextUrl);
    if (this.syncedAudioUrl === normalizedNextUrl) return;

    audio.src = nextUrl;
    this.syncedAudioUrl = normalizedNextUrl;
    audio.load();

    if (this.isPlaying()) {
      void audio.play()
        .then(() => {
          this.playerState.setPlaying(true);
        })
        .catch((error) => {
          console.error('Error reproduciendo nueva canción:', error);
          this.playerState.setPlaying(false);
        });
    }
  }

  private syncPlayback(shouldPlay: boolean): void {
    const audio = this.audioRef?.nativeElement;
    if (!audio) return;

    if (shouldPlay) {
      void audio.play()
        .then(() => {
          this.playerState.setPlaying(true);
        })
        .catch((error) => {
          console.error('Error en syncPlayback:', error);
          this.playerState.setPlaying(false);
        });
      return;
    }

    audio.pause();
  }

  private normalizeAudioUrl(url: string): string {
    if (!url) return '';
    try {
      return new URL(url, window.location.origin).toString();
    } catch {
      return url;
    }
  }

}
