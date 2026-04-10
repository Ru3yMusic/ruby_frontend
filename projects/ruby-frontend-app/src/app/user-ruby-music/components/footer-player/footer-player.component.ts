import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { PlayerState } from '../../state/player.state';

interface StoredArtist {
  id: string;
  name: string;
  photoUrl?: string | null;
}

@Component({
  selector: 'app-footer-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './footer-player.component.html',
  styleUrls: ['./footer-player.component.scss'],
})
export class FooterPlayerComponent implements AfterViewInit {
  private readonly playerState = inject(PlayerState);
  private readonly router = inject(Router);

  private readonly ARTISTS_KEY = 'ruby_artists';
  private readonly defaultCover = '/assets/icons/playlist-cover-placeholder.png';

  @ViewChild('audioRef') audioRef?: ElementRef<HTMLAudioElement>;

  readonly currentSong = this.playerState.currentSong;
  readonly isPlaying = this.playerState.isPlaying;
  readonly currentTime = this.playerState.currentTime;
  readonly duration = this.playerState.duration;
  readonly volume = this.playerState.volume;
  readonly progressPercent = this.playerState.progressPercent;
  readonly hasSong = this.playerState.hasSong;

  readonly isStationRoute = signal(this.router.url.includes('/user/station'));

  readonly artistsCatalog = signal<StoredArtist[]>(this.loadArtists());

  readonly displayCoverUrl = computed(() => {
    return this.currentSong()?.coverUrl || this.defaultCover;
  });

  readonly displayTitle = computed(() => {
    return this.currentSong()?.title || 'Sin reproducción';
  });

  readonly displayArtistName = computed(() => {
    const song = this.currentSong();
    if (!song) return 'Selecciona una canción';

    const artist = this.artistsCatalog().find(item => item.id === song.artistId);
    return artist?.name ?? 'Artista desconocido';
  });

  readonly currentTimeLabel = computed(() => {
    return this.playerState.formatTime(this.currentTime());
  });

  readonly durationLabel = computed(() => {
    return this.playerState.formatTime(this.duration());
  });

  constructor() {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.isStationRoute.set(event.urlAfterRedirects.includes('/user/station'));
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
  }

  ngAfterViewInit(): void {
    const audio = this.audioRef?.nativeElement;
    if (!audio) return;

    audio.volume = this.volume();

    const song = this.currentSong();
    if (song && !this.isStationRoute()) {
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

    this.playerState.setCurrentTime(audio.currentTime);
  }

  onLoadedMetadata(): void {
    if (this.isStationRoute()) return;

    const audio = this.audioRef?.nativeElement;
    if (!audio) return;

    this.playerState.setDuration(audio.duration || this.currentSong()?.durationSeconds || 0);
  }

  onEnded(): void {
    if (this.isStationRoute()) return;

    const audio = this.audioRef?.nativeElement;

    this.playerState.pause();
    this.playerState.setCurrentTime(0);

    if (!audio) return;
    audio.currentTime = 0;
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

    if (audio.src === nextUrl) return;

    audio.src = nextUrl;
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

  private loadArtists(): StoredArtist[] {
    try {
      const raw = localStorage.getItem(this.ARTISTS_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as StoredArtist[]) : [];
    } catch {
      return [];
    }
  }
}