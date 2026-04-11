import { Injectable, computed, signal } from '@angular/core';

export interface PlayerSong {
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

@Injectable({
  providedIn: 'root',
})
export class PlayerState {
  private readonly _currentSong = signal<PlayerSong | null>(null);
  readonly currentSong = this._currentSong.asReadonly();

  private readonly _isPlaying = signal(false);
  readonly isPlaying = this._isPlaying.asReadonly();

  private readonly _currentTime = signal(0);
  readonly currentTime = this._currentTime.asReadonly();

  private readonly _duration = signal(0);
  readonly duration = this._duration.asReadonly();

  private readonly _volume = signal(1);
  readonly volume = this._volume.asReadonly();

  readonly hasSong = computed(() => !!this._currentSong());

  readonly progressPercent = computed(() => {
    const duration = this._duration();
    const currentTime = this._currentTime();

    if (!duration || duration <= 0) return 0;
    return Math.min(100, (currentTime / duration) * 100);
  });

  playSong(song: PlayerSong): void {
    this._currentSong.set(song);
    this._isPlaying.set(true);
    this._currentTime.set(0);
    this._duration.set(song.durationSeconds || 0);
  }

  togglePlayPause(): void {
    if (!this._currentSong()) return;
    this._isPlaying.set(!this._isPlaying());
  }

  pause(): void {
    this._isPlaying.set(false);
  }

  resume(): void {
    if (!this._currentSong()) return;
    this._isPlaying.set(true);
  }

  setPlaying(value: boolean): void {
    this._isPlaying.set(value);
  }

  setCurrentTime(seconds: number): void {
    this._currentTime.set(Math.max(0, seconds));
  }

  setDuration(seconds: number): void {
    this._duration.set(Math.max(0, seconds));
  }

  setVolume(value: number): void {
    const safeValue = Math.min(1, Math.max(0, value));
    this._volume.set(safeValue);
  }

  clearPlayer(): void {
    this._currentSong.set(null);
    this._isPlaying.set(false);
    this._currentTime.set(0);
    this._duration.set(0);
  }

  formatTime(totalSeconds: number): string {
    const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
}