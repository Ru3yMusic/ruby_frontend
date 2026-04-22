import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { InteractionState } from './interaction.state';

/** sessionStorage key — bump the version suffix if the shape ever changes
 *  so stale snapshots from old deploys get dropped instead of misparsed. */
const SNAPSHOT_KEY = 'rubytune:player-snapshot:v1';

interface PlayerSnapshot {
  queue: PlayerSong[];
  queueIndex: number;
  currentTime: number;
  volume: number;
  isShuffle: boolean;
  shuffleOrder: number[];
  isRepeatOne: boolean;
}

export interface PlayerSong {
  id: string;
  title: string;
  artistId: string;
  /** Always populated so the footer never has to depend on LibraryState. */
  artistName: string;
  albumId: string | null;
  albumTitle: string | null;
  genreId: string;
  coverUrl: string;
  audioUrl: string;
  durationSeconds: number;
  lyrics: string | null;
  playCount: number;
  likesCount: number;
  createdAt: string;
}

/**
 * Loose shape accepted by `playSong` / `playQueue`. Callers often hand us a
 * raw catalog-service SongResponse (nested artist/album), or a pre-mapped
 * PlayerSong, or a small custom row. The state normalizes whichever it gets.
 */
export type PlayerSongInput = Partial<PlayerSong> & {
  id?: string;
  title?: string;
  audioUrl?: string;
  coverUrl?: string;
  artist?: { id?: string; name?: string } | null;
  album?: { id?: string; title?: string } | null;
  duration?: number;
  /** Raw catalog-service shape — normalizeInputSong pulls genreId from [0]. */
  genres?: Array<{ id?: string }> | null;
};

@Injectable({
  providedIn: 'root',
})
export class PlayerState {
  private readonly interactionState = inject(InteractionState);

  constructor() {
    // Restore any snapshot from the previous load of this tab BEFORE the
    // persistence effect registers — so the effect's first run just rewrites
    // the same values and nothing visible changes.
    this.restoreSnapshot();

    // Persistence: any change to the tracked signals re-serializes a fresh
    // snapshot. `isPlaying` is intentionally left out of the snapshot — after
    // a refresh the browser blocks autoplay anyway, so we always boot paused
    // and let the user press play. Writes are cheap (tiny JSON + setItem);
    // no debouncing needed.
    effect(() => {
      const snapshot: PlayerSnapshot = {
        queue: this._queue(),
        queueIndex: this._queueIndex(),
        currentTime: this._currentTime(),
        volume: this._volume(),
        isShuffle: this._isShuffle(),
        shuffleOrder: this._shuffleOrder(),
        isRepeatOne: this._isRepeatOne(),
      };
      try {
        sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
      } catch {
        // sessionStorage disabled / quota exceeded — fail silently.
      }
    });
  }

  private readonly _currentSong = signal<PlayerSong | null>(null);
  readonly currentSong = this._currentSong.asReadonly();

  /** Never restored from snapshot: browsers block autoplay after a refresh,
   *  so we always boot paused and let the user start playback explicitly. */
  private readonly _isPlaying = signal(false);
  readonly isPlaying = this._isPlaying.asReadonly();

  private readonly _currentTime = signal(0);
  readonly currentTime = this._currentTime.asReadonly();

  private readonly _duration = signal(0);
  readonly duration = this._duration.asReadonly();

  private readonly _volume = signal(1);
  readonly volume = this._volume.asReadonly();

  // ─── Queue / shuffle / repeat ─────────────────────────────────────────────
  // The queue is the list the current song belongs to (album tracks, playlist
  // songs, "Escuchar ahora", etc.). Transport buttons (prev/next) navigate
  // within it. Callers that don't have a list (single-song plays) hit
  // `playSong` which resets the queue to just that song — next/prev become
  // naturally inactive via `hasQueue`.
  private readonly _queue = signal<PlayerSong[]>([]);
  private readonly _queueIndex = signal(0);
  /** Permutation of queue indices used while shuffle is on. */
  private readonly _shuffleOrder = signal<number[]>([]);
  private readonly _isShuffle = signal(false);
  private readonly _isRepeatOne = signal(false);

  readonly isShuffle = this._isShuffle.asReadonly();
  readonly isRepeatOne = this._isRepeatOne.asReadonly();
  /** True when the queue has more than one track — enables prev/next. */
  readonly hasQueue = computed(() => this._queue().length > 1);

  readonly hasSong = computed(() => !!this._currentSong());

  readonly progressPercent = computed(() => {
    const duration = this._duration();
    const currentTime = this._currentTime();

    if (!duration || duration <= 0) return 0;
    return Math.min(100, (currentTime / duration) * 100);
  });

  /**
   * Single-song play. Resets the queue to `[song]` so prev/next are inactive
   * until a caller explicitly provides a list via `playQueue`. Callers that
   * do know the surrounding list (album/artist/playlist/liked/"Escuchar
   * ahora"/library cards) should use `playQueue(songs, startIndex)` instead.
   */
  playSong(song: PlayerSongInput): void {
    const normalized = this.normalizeInputSong(song);
    this._queue.set([normalized]);
    this._queueIndex.set(0);
    this._shuffleOrder.set(this._isShuffle() ? [0] : []);
    this.applySongPlayback(normalized);
  }

  /**
   * Starts playback of a list. `startIndex` is the item to begin with — the
   * remaining items become the queue for next/previous. Shuffle is preserved:
   * if it was on, we generate a new shuffle order starting at `startIndex`.
   */
  playQueue(songs: PlayerSongInput[], startIndex = 0): void {
    if (!songs.length) return;
    const safe = Math.max(0, Math.min(startIndex, songs.length - 1));
    const normalized = songs.map((s) => this.normalizeInputSong(s));
    this._queue.set(normalized);
    this._queueIndex.set(safe);
    if (this._isShuffle()) {
      this._shuffleOrder.set(this.makeShuffleOrder(normalized.length, safe));
    } else {
      this._shuffleOrder.set([]);
    }
    this.applySongPlayback(normalized[safe]);
  }

  next(): void {
    const nextIdx = this.computeNextIndex();
    if (nextIdx === null) return;
    this._queueIndex.set(nextIdx);
    this.applySongPlayback(this._queue()[nextIdx]);
  }

  previous(): void {
    const prevIdx = this.computePreviousIndex();
    if (prevIdx === null) {
      this._currentTime.set(0);
      return;
    }
    this._queueIndex.set(prevIdx);
    this.applySongPlayback(this._queue()[prevIdx]);
  }

  toggleShuffle(): void {
    const next = !this._isShuffle();
    this._isShuffle.set(next);
    if (next) {
      this._shuffleOrder.set(
        this.makeShuffleOrder(this._queue().length, this._queueIndex()),
      );
    } else {
      this._shuffleOrder.set([]);
    }
  }

  toggleRepeatOne(): void {
    this._isRepeatOne.set(!this._isRepeatOne());
  }

  /**
   * Called by the footer's <audio> `ended` event. Restarts the current song
   * when repeat-one is on, otherwise advances to the next queue entry. When
   * the queue is exhausted, pauses at 0 (no auto-wrap).
   */
  advanceOnEnded(): void {
    if (this._isRepeatOne()) {
      const current = this._currentSong();
      if (!current) return;
      this._currentTime.set(0);
      this._isPlaying.set(true);
      return;
    }
    const nextIdx = this.computeNextIndex();
    if (nextIdx === null) {
      this._isPlaying.set(false);
      this._currentTime.set(0);
      return;
    }
    this._queueIndex.set(nextIdx);
    this.applySongPlayback(this._queue()[nextIdx]);
  }

  private computeNextIndex(): number | null {
    const queue = this._queue();
    const currentIdx = this._queueIndex();
    if (queue.length <= 1) return null;
    if (this._isShuffle()) {
      const order = this._shuffleOrder();
      const pos = order.indexOf(currentIdx);
      if (pos < 0 || pos >= order.length - 1) return null;
      return order[pos + 1];
    }
    if (currentIdx >= queue.length - 1) return null;
    return currentIdx + 1;
  }

  private computePreviousIndex(): number | null {
    const queue = this._queue();
    const currentIdx = this._queueIndex();
    if (queue.length <= 1) return null;
    if (this._isShuffle()) {
      const order = this._shuffleOrder();
      const pos = order.indexOf(currentIdx);
      if (pos <= 0) return null;
      return order[pos - 1];
    }
    if (currentIdx <= 0) return null;
    return currentIdx - 1;
  }

  /** Builds a shuffle permutation that starts at `startIndex` so the current
   * song stays in place at position 0 of the shuffle order. */
  private makeShuffleOrder(length: number, startIndex: number): number[] {
    if (length <= 0) return [];
    const rest: number[] = [];
    for (let i = 0; i < length; i++) {
      if (i !== startIndex) rest.push(i);
    }
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return [startIndex, ...rest];
  }

  /**
   * Internal: normalises any song-like input into a proper PlayerSong. Some
   * callers hand us a raw SongResponse (`song.artist.name`, `song.duration`),
   * others pre-map into PlayerSong shape. We accept both and always produce a
   * PlayerSong with `artistName` populated so the footer never has to look
   * that up from LibraryState (which was the root cause of "Artista
   * desconocido" when playing from album/artist/playlist/library).
   */
  private normalizeInputSong(input: PlayerSongInput): PlayerSong {
    const artistId = input.artistId ?? input.artist?.id ?? '';
    const artistName =
      input.artistName
      ?? input.artist?.name
      ?? '';
    const albumId =
      input.albumId !== undefined ? input.albumId : (input.album?.id ?? null);
    const albumTitle =
      input.albumTitle !== undefined ? input.albumTitle : (input.album?.title ?? null);
    const durationSeconds =
      input.durationSeconds ?? input.duration ?? 0;
    // Same fallback pattern as artistId/albumId — if the caller only has the
    // nested catalog-service shape (genres[0].id), surface that as genreId so
    // the right-panel "Músicas relacionadas" filter has something to work with.
    const genreId = input.genreId ?? input.genres?.[0]?.id ?? '';
    return {
      id: input.id ?? '',
      title: input.title ?? '',
      artistId,
      artistName: artistName || 'Artista desconocido',
      albumId: albumId ?? null,
      albumTitle: albumTitle ?? null,
      genreId,
      coverUrl: input.coverUrl ?? '',
      audioUrl: input.audioUrl ?? '',
      durationSeconds,
      lyrics: input.lyrics ?? null,
      playCount: input.playCount ?? 0,
      likesCount: input.likesCount ?? 0,
      createdAt: input.createdAt ?? '',
    };
  }

  /**
   * Reads a persisted snapshot out of sessionStorage and seeds the signals
   * so a refresh lands on the same song/queue/time the user left off at.
   * Called once in the constructor before the persistence effect registers.
   * Any malformed snapshot is dropped silently (bumping SNAPSHOT_KEY on
   * breaking changes is the clean version).
   */
  private restoreSnapshot(): void {
    let raw: string | null;
    try {
      raw = sessionStorage.getItem(SNAPSHOT_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    let snap: Partial<PlayerSnapshot>;
    try {
      snap = JSON.parse(raw) as Partial<PlayerSnapshot>;
    } catch {
      try { sessionStorage.removeItem(SNAPSHOT_KEY); } catch { /* noop */ }
      return;
    }

    if (!Array.isArray(snap.queue) || snap.queue.length === 0) return;
    const safeIndex = Math.max(
      0,
      Math.min(snap.queueIndex ?? 0, snap.queue.length - 1),
    );
    const song = snap.queue[safeIndex];
    if (!song?.id || !song?.audioUrl) return;

    this._queue.set(snap.queue);
    this._queueIndex.set(safeIndex);
    this._currentSong.set(song);
    this._currentTime.set(Math.max(0, snap.currentTime ?? 0));
    this._duration.set(song.durationSeconds || 0);
    if (typeof snap.volume === 'number') {
      this._volume.set(Math.min(1, Math.max(0, snap.volume)));
    }
    this._isShuffle.set(!!snap.isShuffle);
    this._shuffleOrder.set(
      Array.isArray(snap.shuffleOrder) ? snap.shuffleOrder : [],
    );
    this._isRepeatOne.set(!!snap.isRepeatOne);
    // isPlaying stays false — autoplay policy + user intent to be explicit.
  }

  /** Internal: common side-effects of starting a song. Does NOT mutate the
   * queue — callers manage that via `playSong` / `playQueue` / navigation. */
  private applySongPlayback(song: PlayerSong): void {
    const previousId = this._currentSong()?.id;
    this._currentSong.set(song);
    this._isPlaying.set(true);
    this._currentTime.set(0);
    this._duration.set(song.durationSeconds || 0);

    // Registrar reproducción solo cuando cambia la canción.
    // Pause/resume/seek no pasan por acá → no cuentan.
    if (song.id && song.id !== previousId) {
      this.interactionState.recordPlay(song.id);
    }
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
    this._queue.set([]);
    this._queueIndex.set(0);
    this._shuffleOrder.set([]);
  }

  formatTime(totalSeconds: number): string {
    const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
}