import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { API_GATEWAY_URL, RealtimePort, WsCommentPayload } from 'lib-ruby-core';
import { SongResponse, StationResponse, ArtistResponse } from 'lib-ruby-sdks/catalog-service';
import { UsersApi, UserResponse } from 'lib-ruby-sdks/auth-service';
import { ReportsApi, ReportTargetType } from 'lib-ruby-sdks/social-service';
import { catchError, of } from 'rxjs';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { LibraryState } from '../../state/library.state';
import { InteractionState } from '../../state/interaction.state';
import { FriendsState } from '../../state/friends.state';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';

@Component({
  selector: 'app-station-detail',
  standalone: true,
  imports: [CommonModule, ImgFallbackDirective],
  templateUrl: './station-detail.component.html',
  styleUrls: ['./station-detail.component.scss'],
})
export class StationDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly MAX_STATION_COMMENTS = 200;
  private readonly UI_TIME_UPDATE_INTERVAL_MS = 250;
  private lastUiTimeUpdateAt = 0;

  @ViewChild('stationAudio0') audio0Ref?: ElementRef<HTMLAudioElement>;
  @ViewChild('stationAudio1') audio1Ref?: ElementRef<HTMLAudioElement>;
  /**
   * Which of the two <audio> elements is currently the audible "speaker" —
   * the other is the silent "warmer" pre-buffering the broadcast's next
   * song. Flipped when a track transition is observed and the warmer is
   * fully decoded; the role swap is what makes transitions gapless instead
   * of suffering the ~1 s decode penalty of re-assigning src on a single
   * element.
   */
  private activeAudioIndex: 0 | 1 = 0;

  /**
   * Last songId fed to the warmer <audio>, so we don't kick off the same
   * download twice on repeated track_changed events for the same nextSongId.
   * Reset to null whenever the active station changes — the new station's
   * queue is unrelated.
   */
  private lastPreloadedSongId: string | null = null;

  /**
   * True while the fallback path of {@link startCurrentSongIfReady} is loading
   * the CURRENT broadcast song on the warmer (waiting for canplay before the
   * gapless swap). During this window we MUST NOT let
   * {@link applyNextTrackPreload} overwrite the warmer's src — it would
   * silently swap us to the next-next song instead of the current one. The
   * pending nextSongId is parked in {@link deferredNextPreloadSongId} and
   * applied after the swap completes.
   */
  private warmerFallbackInProgress = false;

  /**
   * Holds a nextSongId that arrived while {@link warmerFallbackInProgress} was
   * true. Applied via {@link applyNextTrackPreload} once the swap finishes,
   * targeting the post-swap warmer (which is the OPPOSITE element from the
   * one that just got promoted).
   */
  private deferredNextPreloadSongId: string | null = null;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authState = inject(AuthState);
  private readonly libraryState = inject(LibraryState);
  private readonly interactionState = inject(InteractionState);
  private readonly friendsState = inject(FriendsState);
  private readonly realtimePort = inject(RealtimePort);
  private readonly reportsApi = inject(ReportsApi);
  private readonly usersApi = inject(UsersApi);
  private readonly http = inject(HttpClient);
  private readonly gatewayUrl = inject(API_GATEWAY_URL);

  /**
   * Lazy cache: userId → avatar URL resolved from auth-service.
   * Needed because the JWT intentionally omits profilePhotoUrl (size limit),
   * so realtime-ws-ms persists comments with profile_photo_url: null. We fall
   * back to usersApi.batchGetUsers on demand per unique author.
   *
   * Values:
   *   - missing key: never fetched yet
   *   - empty string: fetch in flight (marker to avoid duplicate requests)
   *   - non-empty string: resolved URL
   *   - null: fetched, user has no photo
   */
  private readonly _userAvatars = signal<Record<string, string | null>>({});

  private readonly defaultAvatar = '/assets/icons/avatar-placeholder.png';
  private readonly defaultCover = '/assets/icons/playlist-cover-placeholder.png';
  private pendingPlaybackOffsetSeconds = 0;
  /**
   * Wallclock (Date.now()) of the last server playback snapshot we applied.
   * Used to derive the live broadcast offset when audio resumes from a long
   * pause — for example after the autoplay retry kicks in 30 s after a page
   * reload. Without this, the audio resumes from a stale offset and the user
   * lands ~N seconds behind everyone else in the station.
   */
  private lastSnapshotAtMs = 0;
  private syncedStationAudioUrl: string | null = null;
  private lastLoadedCommentsKey: string | null = null;

  /**
   * Set when the browser's autoplay policy rejected a {@code .play()} call —
   * typically right after a page reload, where the new document has no
   * transient user activation yet. We register a one-shot {@code pointerdown}
   * + {@code keydown} listener on the document; the next user gesture
   * triggers a re-sync to the LIVE broadcast offset (using
   * {@link lastSnapshotAtMs}) and resumes playback. Single shared handler so
   * we never accumulate listeners across multiple snapshot updates.
   */
  private autoplayRetryHandler: ((e: Event) => void) | null = null;

  private readonly SNAPSHOT_RESYNC_THRESHOLD_SECONDS = 1.5;

  readonly reportReasons = [
    'Acoso o bullying',
    'Incita a la violencia',
    'Racismo o discriminación',
    'Contenido inapropiado',
    'Spam o publicidad',
  ];

  readonly currentUser = this.authState.currentUser;

  // ─── Realtime-fed signals ─────────────────────────────────────────────────

  /** Chat comments received via WebSocket new_comment events. */
  readonly stationComments = signal<WsCommentPayload[]>([]);

  /**
   * Current station session version, propagated by the server in
   * `joined_station` and `track_changed` payloads. Bumps when the server
   * detects count===0 (everyone left) — the next audience starts at a higher
   * version and the GET filter hides the previous audience's comments.
   *
   * Null until the first `joined_station` ack arrives or after a stationId
   * change wipes local state.
   */
  readonly currentSessionVersion = signal<number | null>(null);

  /**
   * Live listener count received via joined_station ack and listener_count updates.
   * Starts at 0 until the server confirms the join.
   */
  readonly liveListenersCount = signal(0);

  /**
   * Handle for the presence heartbeat interval. Redis scores each listener by
   * the epoch ms they were last seen, and prunes entries older than 5 min in
   * `getActiveListenerCount`. Without periodic refresh the first arrivals drop
   * out of the count even though their socket is still connected.
   */
  private presenceHeartbeatHandle: ReturnType<typeof setInterval> | null = null;

  // ─── Friendship toast (Conectar feedback) ────────────────────────────────
  readonly friendshipToastMessage = signal('');
  readonly isFriendshipToastVisible = signal(false);

  // ─── UI state ─────────────────────────────────────────────────────────────

  readonly currentStationId = signal<string | null>(null);
  readonly currentSongIndex = signal(0);
  readonly messageInput = signal('');
  readonly currentTimeSeconds = signal(0);
  readonly durationSeconds = signal(0);
  readonly openCommentMenuId = signal<string | null>(null);
  readonly isReportModalOpen = signal(false);
  readonly selectedCommentForAction = signal<WsCommentPayload | null>(null);
  readonly replyTargetComment = signal<WsCommentPayload | null>(null);
  readonly selectedReportReason = signal('');
  readonly reportLoading = signal(false);

  // ─── Station songs (loaded from backend per stationId) ───────────────────

  private readonly _stationSongs = signal<SongResponse[]>([]);

  // ─── Catalog computed ─────────────────────────────────────────────────────

  readonly currentStation = computed<StationResponse | null>(() => {
    const stationId = this.currentStationId();
    if (!stationId) return null;
    return this.libraryState.stations().find(s => s['id'] === stationId) ?? null;
  });

  readonly currentStationIndex = computed(() => {
    const stationId = this.currentStationId();
    if (!stationId) return -1;
    return this.libraryState.stations().findIndex(s => s['id'] === stationId);
  });

  /** Station songs loaded from the backend via getSongsByStation(stationId). */
  readonly stationSongs = this._stationSongs.asReadonly();

  readonly currentSong = computed<SongResponse | null>(() => {
    const songs = this.stationSongs();
    const index = this.currentSongIndex();
    if (!songs.length) return null;
    if (index < 0 || index >= songs.length) return songs[0];
    return songs[index];
  });

  readonly currentArtist = computed<ArtistResponse | null>(() => {
    const song = this.currentSong();
    if (!song) return null;
    return this.libraryState.artists().find(a => a.id === song.artist?.id) ?? null;
  });

  readonly visibleComments = computed(() => {
    const stationId = this.currentStationId();
    if (!stationId) return [];
    // Render every comment for the current station; the list container has
    // max-height + overflow-y so the user can scroll the history in place
    // instead of relying on the narrow global scrollbar.
    return this.stationComments().filter(c => c.stationId === stationId);
  });

  readonly commentsCount = computed(() => {
    const stationId = this.currentStationId();
    if (!stationId) return 0;
    return this.stationComments().filter(c => c.stationId === stationId).length;
  });

  readonly isCurrentSongLiked = computed(() => {
    const song = this.currentSong();
    if (!song?.['id']) return false;
    return this.interactionState.isSongLiked(song['id'] as string);
  });

  readonly currentSongLikesCount = computed(() => {
    const song = this.currentSong();
    const baseCount = (song?.['likesCount'] as number | undefined) ?? 0;
    const songId = song?.['id'] as string | undefined;
    const delta = songId ? this.interactionState.getLikesCountDelta(songId) : 0;
    return Math.max(0, baseCount + delta);
  });

  readonly currentTimeLabel = computed(() => this.formatTime(this.currentTimeSeconds()));
  readonly durationLabel = computed(() => this.formatTime(this.durationSeconds()));

  readonly progressPercent = computed(() => {
    const duration = this.durationSeconds();
    if (!duration) return 0;
    return (this.currentTimeSeconds() / duration) * 100;
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Load catalog data if not yet loaded
    this.libraryState.loadActiveStations();
    this.libraryState.loadRecentSongs();
    this.libraryState.loadArtists();

    // Keep the friendship list fresh so the "Conectar" menu option can be
    // hidden for users that are already friends with the current user.
    this.friendsState.loadFriends();

    // Restore the user's liked-songs set so the heart icon stays filled
    // after a page refresh (otherwise `_likedSongIds` starts empty and
    // `isSongLiked` wrongly returns false even if the backend has the like).
    this.interactionState.loadLikedSongs();

    // Subscribe to realtime streams (auto-unsubscribed on component destroy)
    this.subscribeToRealtimeEvents();

    // Keep this socket's presence score fresh in Redis so it does NOT fall
    // out of the station listener count after 5 min of inactivity (the TTL
    // the backend uses for ZCOUNT pruning). Without this heartbeat, the first
    // listener in a station appears to "leave" whenever a fresh viewer joins
    // later — looks like the count is segmented by song, but really it's
    // TTL-based pruning.
    // Defensive: clear any previous handle in case ngOnInit ran twice (HMR /
    // re-navigation without a prior ngOnDestroy). Without this a second init
    // would orphan the first interval and keep pinging forever.
    if (this.presenceHeartbeatHandle !== null) {
      clearInterval(this.presenceHeartbeatHandle);
    }
    this.presenceHeartbeatHandle = setInterval(() => {
      this.realtimePort.pingPresence();
    }, 60_000);

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const nextStationId = params.get('id');
      if (!nextStationId) return;

      const previousStationId = this.currentStationId();
      if (previousStationId && previousStationId !== nextStationId) {
        this.realtimePort.leaveStation();
      }

      this.currentStationId.set(nextStationId);
      this.currentSongIndex.set(0);
      this.currentTimeSeconds.set(0);
      this.durationSeconds.set(0);
      this.pendingPlaybackOffsetSeconds = 0;
      this.syncedStationAudioUrl = null;
      this.lastPreloadedSongId = null;
      this.warmerFallbackInProgress = false;
      this.deferredNextPreloadSongId = null;
      this.clearNextTrackPreload();
      this.lastLoadedCommentsKey = null;
      this.openCommentMenuId.set(null);
      this.isReportModalOpen.set(false);
      this.selectedCommentForAction.set(null);
      this.replyTargetComment.set(null);
      this.selectedReportReason.set('');
      this.stationComments.set([]);
      this.currentSessionVersion.set(null);
      this.liveListenersCount.set(0);
      this.loadStationSongs(nextStationId);
    });
  }

  ngAfterViewInit(): void {
    // Playback starts after joined_station provides the shared station offset.
  }

  ngOnDestroy(): void {
    if (this.presenceHeartbeatHandle !== null) {
      clearInterval(this.presenceHeartbeatHandle);
      this.presenceHeartbeatHandle = null;
    }
    const stationId = this.currentStationId();
    if (stationId) {
      this.realtimePort.leaveStation();
    }
    this.pauseAudio();
    this.cleanupAutoplayRetry();
  }

  private subscribeToRealtimeEvents(): void {
    // Incoming comments — dedupe by commentId since the same message may arrive
    // both from the historical HTTP load and from the WS broadcast in race
    // scenarios (self-echo right after sending, or a listener joining mid-flight).
    this.realtimePort.onNewComment()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(comment => {
        // Drop broadcasts whose version doesn't match the current session.
        // Tolerates `sessionVersion === undefined` (legacy broadcasts from a
        // ws-ms that predates F4) so we don't strand otherwise-valid comments.
        // The check still rejects mismatches between two known versions —
        // the actual stale-after-reset scenario.
        const localVersion = this.currentSessionVersion();
        const remoteVersion = comment.sessionVersion;
        if (
          localVersion !== null
          && remoteVersion !== undefined
          && remoteVersion !== null
          && remoteVersion !== localVersion
        ) {
          return;
        }
        this.stationComments.update(list => {
          if (list.some(c => c.commentId === comment.commentId)) return list;
          const next = [...list, comment];
          return next.length > this.MAX_STATION_COMMENTS
            ? next.slice(next.length - this.MAX_STATION_COMMENTS)
            : next;
        });
        this.preloadAvatars([comment]);
      });

    // Listener count from joined_station ack
    this.realtimePort.onJoinedStation()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(payload => {
        if (payload.stationId !== this.currentStationId()) return;
        this.liveListenersCount.set(payload.listenerCount);
        this.applySessionVersion(payload.sessionVersion);
        this.applyPlaybackSnapshot(payload.stationId, payload.songId, payload.offsetSeconds);
        this.applyNextTrackPreload(payload.nextSongId);
      });

    this.realtimePort.onTrackChanged()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(payload => {
        if (payload.stationId !== this.currentStationId()) return;
        this.applySessionVersion(payload.sessionVersion);
        this.applyPlaybackSnapshot(payload.stationId, payload.songId, payload.offsetSeconds);
        this.applyNextTrackPreload(payload.nextSongId);
      });

    // Listener count live updates
    this.realtimePort.onListenerCount()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(payload => {
        if (payload.stationId === this.currentStationId()) {
          this.liveListenersCount.set(payload.count);
        }
      });

    // Real-time comment deletion — remove the card for everyone in the station
    // when someone deletes their own comment (owner did the HTTP DELETE; the
    // WS event tells the other viewers to drop it from the list too).
    this.realtimePort.onCommentDeleted()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(payload => {
        if (payload.stationId !== this.currentStationId()) return;
        this.stationComments.update(list =>
          list.filter(c => c.commentId !== payload.commentId),
        );
      });

    // Real-time like-count deltas — sync the counter when another user
    // in the same station likes or unlikes the current song. Ignores events
    // from the current user so we don't double-count our own optimistic bump.
    this.realtimePort.onLikeDelta()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(payload => {
        if (payload.stationId !== this.currentStationId()) return;
        const me = this.currentUser()?.id;
        if (me && payload.actorId && payload.actorId === me) return;
        this.interactionState.applyRemoteLikeDelta(payload.songId, payload.delta);
      });
  }

  // ─── Station Songs ────────────────────────────────────────────────────────

  private loadStationSongs(stationId: string): void {
    this._stationSongs.set([]);
    this.libraryState.getSongsByStation(stationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (songs) => {
          this._stationSongs.set(songs);
          const tracks = songs
            .filter((s) => !!s.id && Number.isFinite(s.duration) && (s.duration ?? 0) > 0)
            .map((s) => ({ songId: s.id as string, durationSeconds: Math.floor((s.duration as number) || 0) }));

          if (tracks.length > 0) {
            this.realtimePort.joinStation(stationId, tracks);
            // Immediate heartbeat so the Redis ZSET score is fresh from t=0
            // instead of waiting for the first 60 s tick of the interval.
            this.realtimePort.pingPresence();
          }
        },
        error: () => this._stationSongs.set([]),
      });
  }

  /**
   * Loads persisted comments for the current station+song so the chat is not
   * empty on entry/reentry. Merged with the WS stream via dedupe-by-commentId
   * in subscribeToRealtimeEvents. Silent no-op on failure — the realtime
   * stream still works, just without backlog.
   */
  private loadHistoricalComments(stationId: string, songId: string): void {
    const versionAtRequest = this.currentSessionVersion();
    // Include the version in the cache key so a version bump (count===0 reset)
    // forces a refetch even when stationId+songId stay the same.
    const requestKey = `${stationId}:${songId}:${versionAtRequest ?? 'none'}`;
    if (this.lastLoadedCommentsKey === requestKey) return;
    this.lastLoadedCommentsKey = requestKey;

    const url = `${this.gatewayUrl}/api/v1/realtime/comments`;
    const params: Record<string, string> = { songId, stationId, sort: 'recent', page: '0', size: '20' };
    if (versionAtRequest !== null) {
      params['currentVersion'] = String(versionAtRequest);
    }

    this.http
      .get<HistoricalCommentsResponse>(url, { params })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          // The API returns newest-first (sort=recent). The UI appends new WS
          // comments at the end, so we reverse here to keep natural ordering
          // (oldest → newest, with fresh realtime messages continuing the tail).
          const historical = (response.content ?? [])
            .map(this.mapHistoricalComment)
            .reverse();
          if (!historical.length) return;

          // If the targeted station changed during the request (user navigated
          // away), drop the result to avoid polluting the new station's chat.
          if (this.currentStationId() !== stationId) return;

          // If the session version moved on while the request was in-flight
          // (audience drained then refilled), the result belongs to a dead
          // version — discard so the next refetch with the new version wins.
          if (this.currentSessionVersion() !== versionAtRequest) return;

          this.stationComments.update((list) => {
            const seen = new Set(list.map((c) => c.commentId));
            const toPrepend = historical.filter((c) => !seen.has(c.commentId));
            const merged = [...toPrepend, ...list];
            return merged.length > this.MAX_STATION_COMMENTS
              ? merged.slice(merged.length - this.MAX_STATION_COMMENTS)
              : merged;
          });
          this.preloadAvatars(historical);
        },
        error: () => { /* silent — UI still works via WS stream */ },
      });
  }

  private mapHistoricalComment = (raw: RawComment): WsCommentPayload => ({
    commentId:       raw.comment_event_id,
    songId:          raw.song_id,
    stationId:       raw.station_id,
    userId:          raw.user_id,
    username:        raw.username,
    profilePhotoUrl: raw.profile_photo_url ?? null,
    content:         raw.content,
    mentions:        raw.mentions ?? [],
    likesCount:      raw.likes_count ?? 0,
    createdAt:       typeof raw.created_at === 'string'
                       ? raw.created_at
                       : new Date(raw.created_at).toISOString(),
    sessionVersion:  raw.session_version ?? 1,
  });

  // ─── Audio / Player ───────────────────────────────────────────────────────

  private getAudio(idx: 0 | 1): HTMLAudioElement | null {
    return idx === 0
      ? this.audio0Ref?.nativeElement ?? null
      : this.audio1Ref?.nativeElement ?? null;
  }
  private getActiveAudio(): HTMLAudioElement | null {
    return this.getAudio(this.activeAudioIndex);
  }
  private getPreloadAudio(): HTMLAudioElement | null {
    return this.getAudio(this.activeAudioIndex === 0 ? 1 : 0);
  }

  startCurrentSongIfReady(): void {
    const song = this.currentSong();
    if (!song) return;

    const rawAudioUrl = (song['audioUrl'] as string | undefined) ?? '';
    if (!rawAudioUrl) return;

    const songDuration = Number(song.duration ?? 0);
    const desiredOffset = Number.isFinite(songDuration) && songDuration > 0
      ? Math.min(Math.max(0, this.pendingPlaybackOffsetSeconds), Math.max(0, songDuration - 1))
      : Math.max(0, this.pendingPlaybackOffsetSeconds);

    const normalizedNextUrl = this.normalizeAudioUrl(rawAudioUrl);

    const active = this.getActiveAudio();
    const preload = this.getPreloadAudio();
    if (!active) return;

    // Gapless transition: the warmer (preload) already has THIS exact song
    // decoded and ready. Just .play() it and pause the old speaker — zero
    // network/decode wait. Only kicks in for actual track changes (not for
    // mid-song resyncs where the active already has the right song).
    const preloadHasSong = preload
      && this.normalizeAudioUrl(preload.src ?? '') === normalizedNextUrl
      && preload.readyState >= 3 // HAVE_FUTURE_DATA — enough buffered to play
      && this.syncedStationAudioUrl !== normalizedNextUrl; // only swap on a track CHANGE
    if (preloadHasSong && preload) {
      preload.muted = false;
      try { preload.currentTime = desiredOffset; } catch { /* element may not be seekable yet */ }
      const playPromise = preload.play();
      if (playPromise instanceof Promise) {
        playPromise.catch(() => this.armAutoplayRetry());
      }
      try { active.pause(); } catch { /* ignore */ }
      this.activeAudioIndex = (this.activeAudioIndex === 0 ? 1 : 0);
      this.syncedStationAudioUrl = normalizedNextUrl;
      this.currentTimeSeconds.set(desiredOffset);
      const dur = Number.isFinite(preload.duration) ? preload.duration : 0;
      this.durationSeconds.set(dur);
      return;
    }

    // The fast swap path didn't apply. Two situations bring us here:
    //  (1) syncedStationAudioUrl already === normalizedNextUrl — same song,
    //      mid-song resync (just nudge offset / resume play on the speaker).
    //  (2) syncedStationAudioUrl !== normalizedNextUrl — broadcast jumped to
    //      a song we don't have decoded on the warmer (queue change, reload,
    //      or station switch). Drive the load through the WARMER, not the
    //      speaker. Pisar `active.src` aborted current playback for hundreds
    //      of ms while the new file metadata loaded — that gap is what users
    //      perceived as "se congela la música". By loading on the warmer we
    //      keep the speaker audible (previous song continues) until the
    //      warmer is ready, then swap roles gaplessly.
    const shouldReloadSource = this.syncedStationAudioUrl !== normalizedNextUrl;

    if (!shouldReloadSource) {
      if (Math.abs((active.currentTime ?? 0) - desiredOffset) > 1.5) {
        active.currentTime = desiredOffset;
        this.currentTimeSeconds.set(desiredOffset);
      }
      if (active.paused) {
        const playPromise = active.play();
        if (playPromise instanceof Promise) {
          playPromise.catch(() => this.armAutoplayRetry());
        }
      }
      return;
    }

    // Two flavours of fallback. The choice is driven by whether anything is
    // currently audible on the speaker:
    //
    //  - Speaker silent (fresh mount, post-reload, or post station-switch):
    //    nothing to preserve. Load on the speaker directly. This keeps the
    //    follow-up applyNextTrackPreload (which writes to the warmer) free
    //    to use its own slot without colliding with our load.
    //
    //  - Speaker audible (broadcast jumped mid-listen — server fired a
    //    track_changed for a song the warmer wasn't holding): load on the
    //    warmer instead so the speaker keeps playing the old song until the
    //    new file is decoded, then swap roles gaplessly. WITHOUT this, the
    //    old single-element fallback aborted speaker playback for hundreds
    //    of ms while the new file's metadata loaded — perceived as freeze.
    const speakerSilent = !preload || active.paused || !active.src;
    if (speakerSilent) {
      active.muted = false;
      active.src = rawAudioUrl;
      this.syncedStationAudioUrl = normalizedNextUrl;
      active.load();
      active.addEventListener('loadedmetadata', () => {
        active.currentTime = desiredOffset;
        this.currentTimeSeconds.set(desiredOffset);
        const p = active.play();
        if (p instanceof Promise) p.catch(() => this.armAutoplayRetry());
      }, { once: true });
      return;
    }

    const warmerHasUrl = this.normalizeAudioUrl(preload!.src ?? '') === normalizedNextUrl;
    if (!warmerHasUrl) {
      preload!.muted = true;
      preload!.src = rawAudioUrl;
      preload!.load();
      // Nullify so a follow-up applyNextTrackPreload (called RIGHT after
      // applyPlaybackSnapshot in the joined_station / track_changed
      // subscribers) doesn't see this slot as already-holding-the-right-song
      // and skip the overwrite on the OTHER slot — but more importantly,
      // {@link applyNextTrackPreload} also writes to {@link getPreloadAudio},
      // which is THIS slot until the swap flips activeAudioIndex. To keep it
      // from clobbering our in-progress load, we defer the preload-of-next
      // until the canplay swap finishes.
      this.lastPreloadedSongId = null;
      this.deferredNextPreloadSongId = null; // cleared so deferral starts fresh
    }
    this.warmerFallbackInProgress = true;

    const preloadEl = preload!;
    const promoteWarmer = () => {
      this.warmerFallbackInProgress = false;
      preloadEl.muted = false;
      try { preloadEl.currentTime = desiredOffset; } catch { /* not seekable yet */ }
      const p = preloadEl.play();
      if (p instanceof Promise) p.catch(() => this.armAutoplayRetry());
      try { active.pause(); } catch { /* ignore */ }
      this.activeAudioIndex = this.activeAudioIndex === 0 ? 1 : 0;
      this.syncedStationAudioUrl = normalizedNextUrl;
      this.currentTimeSeconds.set(desiredOffset);
      this.durationSeconds.set(Number.isFinite(preloadEl.duration) ? preloadEl.duration : 0);
      // After the swap, the OTHER element is now the warmer — apply any
      // pending nextSongId that arrived during the load window.
      if (this.deferredNextPreloadSongId) {
        const pending = this.deferredNextPreloadSongId;
        this.deferredNextPreloadSongId = null;
        this.applyNextTrackPreload(pending);
      }
    };

    if (preloadEl.readyState >= 3) {
      promoteWarmer();
    } else {
      preloadEl.addEventListener('canplay', promoteWarmer, { once: true });
    }
  }

  playNextSong(): void {
    const songs = this.stationSongs();
    if (!songs.length) return;
    const nextIndex = (this.currentSongIndex() + 1) % songs.length;
    this.currentSongIndex.set(nextIndex);
    this.currentTimeSeconds.set(0);
    this.durationSeconds.set(0);
    this.pendingPlaybackOffsetSeconds = 0;
    this.startCurrentSongIfReady();
  }

  onAudioLoadedMetadata(idx: 0 | 1): void {
    if (idx !== this.activeAudioIndex) return;
    const audio = this.getActiveAudio();
    if (!audio) return;
    const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
    this.durationSeconds.set(nextDuration);
  }

  onAudioTimeUpdate(idx: 0 | 1): void {
    if (idx !== this.activeAudioIndex) return;
    const audio = this.getActiveAudio();
    if (!audio) return;
    const nextTime = audio.currentTime ?? 0;
    const now = Date.now();
    if (now - this.lastUiTimeUpdateAt >= this.UI_TIME_UPDATE_INTERVAL_MS) {
      this.lastUiTimeUpdateAt = now;
      this.currentTimeSeconds.set(nextTime);
    }
  }

  onAudioEnded(idx: 0 | 1): void {
    // Server-authoritative timeline emits track_changed; client does not re-join on ended.
    // Ignored entirely on the warmer. The dual-buffer swap handles the audible
    // hand-off via track_changed — we do NOT preempt the server's wallclock.
    void idx;
  }

  private pauseAudio(): void {
    try { this.getActiveAudio()?.pause(); } catch { /* ignore */ }
  }

  // ─── Station Navigation ───────────────────────────────────────────────────

  goToPreviousStation(): void {
    const stations = this.libraryState.stations();
    const currentIndex = this.currentStationIndex();
    if (!stations.length || currentIndex === -1) return;
    const previousIndex = (currentIndex - 1 + stations.length) % stations.length;
    this.router.navigate(['/user/station', stations[previousIndex]['id']]);
  }

  goToNextStation(): void {
    const stations = this.libraryState.stations();
    const currentIndex = this.currentStationIndex();
    if (!stations.length || currentIndex === -1) return;
    const nextIndex = (currentIndex + 1) % stations.length;
    this.router.navigate(['/user/station', stations[nextIndex]['id']]);
  }

  // ─── Comments ─────────────────────────────────────────────────────────────

  sendComment(): void {
    const stationId = this.currentStationId();
    const song = this.currentSong();
    const user = this.currentUser();
    const message = this.messageInput().trim();

    if (!stationId || !song?.['id'] || !user?.id || !message) return;

    const mentions = this.resolveMentions(message, user.id);

    this.realtimePort.sendComment({
      commentId: this.createCommentId(),
      songId: song['id'] as string,
      stationId,
      content: message,
      mentions,
    });

    this.messageInput.set('');
    this.replyTargetComment.set(null);
  }

  private createCommentId(): string {
    const maybeCrypto = globalThis.crypto as Crypto | undefined;
    if (maybeCrypto?.randomUUID) {
      return maybeCrypto.randomUUID();
    }

    // Fallback for non-secure contexts (e.g. plain HTTP on public IP) where
    // crypto.randomUUID() may be unavailable.
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Resolves the list of mentioned userIds for the comment being sent.
   *
   * 1. If there's an active replyTargetComment (user clicked "Responder"),
   *    its author is always included — this is the 99% case.
   * 2. Additionally, any @username tokens present in the message text are
   *    resolved against the visible station comments, which carry both
   *    userId and username. Unknown usernames are ignored silently.
   *
   * Self-mentions are filtered out here so the backend never has to deal
   * with them (it also filters defensively).
   */
  private resolveMentions(content: string, selfUserId: string): string[] {
    const mentioned = new Set<string>();

    const replyTarget = this.replyTargetComment();
    if (replyTarget && replyTarget.userId && replyTarget.userId !== selfUserId) {
      mentioned.add(replyTarget.userId);
    }

    const tokens = new Set<string>();
    const regex = /@(\w+)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      tokens.add(match[1].toLowerCase());
    }

    if (tokens.size > 0) {
      const byUsername = new Map<string, string>();
      for (const c of this.stationComments()) {
        if (c.username && c.userId) {
          byUsername.set(c.username.toLowerCase(), c.userId);
        }
      }
      for (const token of tokens) {
        const userId = byUsername.get(token);
        if (userId && userId !== selfUserId) {
          mentioned.add(userId);
        }
      }
    }

    return [...mentioned];
  }

  updateMessageInput(value: string): void {
    this.messageInput.set(value);
    if (!value.trim()) {
      this.replyTargetComment.set(null);
    }
  }

  sendCommentOnEnter(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.sendComment();
  }

  /**
   * Pure getter — invoked from the template on every change detection pass.
   * Must NOT write signals or trigger HTTP. Side-effects (cache population)
   * live in preloadAvatars(), called from the subscribe handlers that mutate
   * stationComments (historical load + onNewComment WS stream).
   */
  getCommentAvatar(comment: WsCommentPayload): string {
    const cached = this._userAvatars()[comment.userId];
    if (cached) return cached;
    if (comment.profilePhotoUrl) return comment.profilePhotoUrl;
    return this.defaultAvatar;
  }

  /**
   * Fires one auth-service batch lookup for every uncached userId. Called
   * OUTSIDE of template rendering, from places where the comment list is
   * mutated (historical HTTP load + WS onNewComment). Safe to call repeatedly
   * — the "already in cache" short-circuit avoids duplicate requests.
   */
  private preloadAvatars(comments: WsCommentPayload[]): void {
    if (!comments.length) return;
    const cache = this._userAvatars();
    const pending = new Set<string>();
    for (const c of comments) {
      if (c.userId && !(c.userId in cache)) pending.add(c.userId);
    }
    if (!pending.size) return;

    // Mark every pending userId as in-flight in a single update so parallel
    // preload calls don't fire duplicate requests for the same user.
    this._userAvatars.update((map) => {
      const next = { ...map };
      for (const id of pending) next[id] = '';
      return next;
    });

    const ids = [...pending];
    this.usersApi
      .batchGetUsers({ ids })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => of<UserResponse[]>([])),
      )
      .subscribe((users) => {
        const usersById = new Map(users.filter((u) => !!u.id).map((u) => [u.id!, u]));
        this._userAvatars.update((map) => {
          const next = { ...map };
          for (const userId of ids) {
            next[userId] = usersById.get(userId)?.profilePhotoUrl ?? null;
          }
          return next;
        });
      });
  }

  // ─── Comment Menu ─────────────────────────────────────────────────────────

  toggleCommentMenu(commentId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.openCommentMenuId() === commentId) {
      this.openCommentMenuId.set(null);
      return;
    }
    this.openCommentMenuId.set(commentId);
  }

  closeCommentMenu(): void {
    this.openCommentMenuId.set(null);
  }

  isCommentMenuOpen(commentId: string): boolean {
    return this.openCommentMenuId() === commentId;
  }

  /**
   * Closes the 3-dot menu on any click that falls outside its host wrapper.
   * The 3-dot button itself calls stopPropagation in toggleCommentMenu, so the
   * opening click never reaches this handler. Clicks inside the menu (menu
   * items) fall under `.station-comment-actions` and are ignored here — each
   * menu item already calls closeCommentMenu() after its action.
   */
  @HostListener('document:click', ['$event'])
  onDocumentClickCloseMenu(event: MouseEvent): void {
    if (this.openCommentMenuId() === null) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.station-comment-actions')) return;
    this.closeCommentMenu();
  }

  replyToComment(comment: WsCommentPayload, event?: MouseEvent): void {
    event?.stopPropagation();
    this.replyTargetComment.set(comment);
    this.messageInput.set(`@${comment.username} `);
    this.closeCommentMenu();
  }

  connectWithUser(comment: WsCommentPayload, event?: MouseEvent): void {
    event?.stopPropagation();
    const currentUser = this.currentUser();
    if (!currentUser?.id || comment.userId === currentUser.id) {
      this.closeCommentMenu();
      return;
    }

    const targetName = comment.username || 'ese usuario';

    // Defensive: if the friendship list already says we're friends, short-circuit
    // with a clear toast instead of hitting the backend and showing an error.
    if (this.friendsState.isFriendWith(currentUser.id, comment.userId)) {
      this.showFriendshipToast(`Ya son amigos con @${targetName}`);
      this.closeCommentMenu();
      return;
    }

    this.friendsState.sendFriendRequest(
      comment.userId,
      () => this.showFriendshipToast(`Solicitud enviada a @${targetName}`),
      (err) => {
        const raw = err?.error?.message ?? err?.message ?? '';
        const msg = String(raw).toLowerCase();
        if (msg.includes('already pending')) {
          this.showFriendshipToast(`Ya tienes una solicitud pendiente con @${targetName}`);
        } else if (msg.includes('already friends')) {
          this.showFriendshipToast(`Ya son amigos con @${targetName}`);
        } else {
          this.showFriendshipToast('No se pudo enviar la solicitud');
        }
      },
    );
    this.closeCommentMenu();
  }

  /** True when the "Conectar" item should show in the 3-dot menu. */
  canConnectWith(comment: WsCommentPayload): boolean {
    const currentUser = this.currentUser();
    if (!currentUser?.id) return false;
    if (comment.userId === currentUser.id) return false;
    return !this.friendsState.isFriendWith(currentUser.id, comment.userId);
  }

  /** True when the current user authored this comment. */
  isOwnComment(comment: WsCommentPayload): boolean {
    const currentUser = this.currentUser();
    return !!currentUser?.id && comment.userId === currentUser.id;
  }

  /**
   * Deletes one of the current user's own comments. Hits
   * DELETE /api/v1/realtime/comments/:id (backend enforces owner-only),
   * removes the card locally, AND fires a `delete_comment` WS event so the
   * other viewers in the same station room drop it from their UI in real time.
   */
  deleteMyComment(comment: WsCommentPayload, event?: MouseEvent): void {
    event?.stopPropagation();
    const stationId = this.currentStationId();
    const url = `${this.gatewayUrl}/api/v1/realtime/comments/${comment.commentId}`;
    this.http
      .delete(url)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.stationComments.update(list =>
            list.filter(c => c.commentId !== comment.commentId),
          );
          if (stationId) {
            this.realtimePort.deleteComment(stationId, comment.commentId);
          }
        },
        error: () => { /* silent — on failure the comment stays visible */ },
      });
    this.closeCommentMenu();
  }

  private showFriendshipToast(message: string): void {
    this.friendshipToastMessage.set(message);
    this.isFriendshipToastVisible.set(true);
    window.setTimeout(() => {
      this.isFriendshipToastVisible.set(false);
      this.friendshipToastMessage.set('');
    }, 2500);
  }

  openReportModal(comment: WsCommentPayload, event?: MouseEvent): void {
    event?.stopPropagation();
    this.selectedCommentForAction.set(comment);
    this.selectedReportReason.set('');
    this.isReportModalOpen.set(true);
    this.closeCommentMenu();
  }

  closeReportModal(): void {
    this.isReportModalOpen.set(false);
    this.selectedCommentForAction.set(null);
    this.selectedReportReason.set('');
  }

  updateSelectedReportReason(value: string): void {
    this.selectedReportReason.set(value);
  }

  submitReport(): void {
    if (this.reportLoading()) return;
    const comment = this.selectedCommentForAction();
    if (!comment) return;

    const reason = this.selectedReportReason() || undefined;
    this.reportLoading.set(true);
    this.reportsApi.createReport({
      targetType: ReportTargetType.COMMENT,
      targetId: comment.commentId,
      reason,
    }).subscribe({
      next: () => {
        this.reportLoading.set(false);
        this.closeReportModal();
      },
      error: (err: { message?: string }) => {
        this.reportLoading.set(false);
        // Modal stays open so user sees the error state
      },
    });
  }

  // ─── Likes ────────────────────────────────────────────────────────────────

  toggleCurrentSongLike(): void {
    const song = this.currentSong();
    const songId = song?.['id'] as string | undefined;
    const stationId = this.currentStationId();
    if (!songId) return;

    // Capture the pre-toggle state BEFORE calling toggleLike, so we know the
    // sign of the delta to broadcast to other viewers in the station room.
    const willLike = !this.interactionState.isSongLiked(songId);
    this.interactionState.toggleLike(songId, song ?? undefined);

    if (stationId) {
      this.realtimePort.emitLikeDelta(stationId, songId, willLike ? 1 : -1);
    }
  }

  // ─── UI Helpers ───────────────────────────────────────────────────────────

  goBack(): void {
    this.router.navigate(['/user/station']);
  }

  goToArtistDetail(): void {
    const artist = this.currentArtist();
    const artistId = artist?.['id'] as string | undefined;
    if (!artistId) return;
    this.router.navigate(['/user/artist', artistId]);
  }

  getStationBackgroundStyle(): string {
    const station = this.currentStation();
    if (!station) return 'linear-gradient(180deg, #1d1d1d 0%, #090909 100%)';
    const start = (station['gradientStart'] as string | undefined) ?? '#1d1d1d';
    const end = (station['gradientEnd'] as string | undefined) ?? '#090909';
    return `linear-gradient(180deg, ${start} 0%, ${end} 100%)`;
  }

  getBackdropImage(): string {
    const coverUrl = this.currentSong()?.['coverUrl'] as string | undefined;
    return coverUrl ?? this.defaultCover;
  }

  getCurrentArtistPhoto(): string {
    const photoUrl = this.currentArtist()?.['photoUrl'] as string | undefined;
    return photoUrl ?? this.defaultAvatar;
  }

  private formatTime(totalSeconds: number): string {
    const safeSeconds = Number.isFinite(totalSeconds)
      ? Math.max(0, Math.floor(totalSeconds))
      : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  private normalizeAudioUrl(url: string): string {
    if (!url) return '';
    try {
      return new URL(url, window.location.origin).toString();
    } catch {
      return url;
    }
  }

  /**
   * Reconciles the local session version with what the server just told us.
   * If it changed (audience drained → bumped), wipe the stale comment list
   * and clear the historical-fetch cache so the next playback snapshot will
   * refetch comments under the new version. Comments from the previous
   * audience are filtered out server-side via the GET ?currentVersion=N filter.
   */
  private applySessionVersion(nextVersion: number): void {
    const previous = this.currentSessionVersion();
    if (previous !== null && previous !== nextVersion) {
      this.stationComments.set([]);
      this.lastLoadedCommentsKey = null;
    }
    if (previous !== nextVersion) {
      this.currentSessionVersion.set(nextVersion);
    }
  }

  private applyPlaybackSnapshot(stationId: string, songId: string, offsetSeconds: number): void {
    const songs = this.stationSongs();
    const resolvedIndex = songs.findIndex((song) => song.id === songId);
    if (resolvedIndex === -1) return;

    const currentSongId = this.currentSong()?.id ?? null;
    const currentOffset = this.currentTimeSeconds();
    const sameSong = currentSongId === songId;
    const offsetDelta = Math.abs(currentOffset - offsetSeconds);
    // True only after startCurrentSongIfReady has successfully loaded the src
    // for this station's <audio>. Without this, the very first joined_station
    // ack — where currentSongId already matches (via stationSongs[0]) and the
    // offset is ~0 — would short-circuit and the <audio> would stay at src=""
    // forever. The skip is safe ONLY mid-playback, not on initial wire-up.
    const audioInitialized = this.syncedStationAudioUrl !== null;

    if (audioInitialized && sameSong && offsetDelta <= this.SNAPSHOT_RESYNC_THRESHOLD_SECONDS) {
      return;
    }

    this.currentSongIndex.set(resolvedIndex);
    this.currentTimeSeconds.set(offsetSeconds);
    this.pendingPlaybackOffsetSeconds = offsetSeconds;
    this.lastSnapshotAtMs = Date.now();
    this.loadHistoricalComments(stationId, songId);
    this.startCurrentSongIfReady();
  }

  /**
   * Compute the LIVE broadcast offset right now, derived from the last server
   * snapshot plus elapsed wallclock. Used by the autoplay retry path so that
   * when the user finally clicks (possibly seconds after the page loaded)
   * the audio resumes at the broadcast's CURRENT position, not the stale
   * position captured at snapshot time.
   */
  private liveBroadcastOffsetSeconds(): number {
    if (!this.lastSnapshotAtMs) return this.pendingPlaybackOffsetSeconds;
    const elapsedSec = Math.max(0, (Date.now() - this.lastSnapshotAtMs) / 1000);
    const song = this.currentSong();
    const dur = Number(song?.duration ?? 0);
    const live = this.pendingPlaybackOffsetSeconds + elapsedSec;
    if (Number.isFinite(dur) && dur > 0) {
      // Clamp to one second before duration — past the end the server will
      // emit track_changed shortly anyway; just don't seek out of bounds.
      return Math.min(Math.max(0, live), Math.max(0, dur - 1));
    }
    return Math.max(0, live);
  }

  /**
   * Register a single document-level listener that, on the next user gesture,
   * resumes playback on the active <audio> at the LIVE broadcast offset. No-op
   * if a handler is already armed.
   *
   * Why document and not component-scoped: the user can click ANYWHERE in the
   * window — sidebar, header, station chrome, the audio elements themselves.
   * One global listener catches them all without each child element needing
   * to bubble through a synthetic handler. Capture-phase keeps it firing even
   * if some descendant calls stopPropagation.
   */
  private armAutoplayRetry(): void {
    if (this.autoplayRetryHandler) return;
    const handler = () => {
      this.cleanupAutoplayRetry();
      const active = this.getActiveAudio();
      if (!active || !active.src) return;
      const offset = this.liveBroadcastOffsetSeconds();
      try { active.currentTime = offset; } catch { /* not seekable yet */ }
      this.currentTimeSeconds.set(offset);
      // Now that we have a verified user gesture, .play() should pass.
      const p = active.play();
      if (p instanceof Promise) {
        p.catch(() => {
          // Still blocked? Re-arm so the NEXT gesture tries again. Rare —
          // would mean the gesture didn't propagate user activation (e.g.
          // synthetic event). Don't loop forever; the re-arm matches the
          // original cause-and-effect.
          this.armAutoplayRetry();
        });
      }
    };
    this.autoplayRetryHandler = handler;
    document.addEventListener('pointerdown', handler, { capture: true, passive: true });
    document.addEventListener('keydown', handler, { capture: true, passive: true });
  }

  private cleanupAutoplayRetry(): void {
    if (!this.autoplayRetryHandler) return;
    document.removeEventListener('pointerdown', this.autoplayRetryHandler, true);
    document.removeEventListener('keydown', this.autoplayRetryHandler, true);
    this.autoplayRetryHandler = null;
  }

  /**
   * Warms the browser's media cache for the song that comes after the one
   * currently playing in the broadcast queue. The server tells us which
   * songId is "next" via {@code joined_station} / {@code track_changed}; we
   * resolve its mp3 URL from {@link stationSongs} and assign it to a hidden
   * {@code <audio preload="auto">}. The browser fetches and decodes in the
   * background, so when the wallclock crosses into that song the main
   * {@code <audio>} swap is served from cache instead of stalling on a
   * fresh network request.
   *
   * No-ops when the queue has no distinct "next" (single-song station) or
   * when the same songId was already preloaded — repeated track_changed
   * events for the same target should not retrigger the download.
   */
  private applyNextTrackPreload(nextSongId: string | undefined | null): void {
    if (!nextSongId) {
      // Don't wipe a fallback that's mid-load just because nextSongId is
      // null/empty — that would abort the current song's load. The deferred
      // slot is independent state; clearing it is fine.
      if (this.warmerFallbackInProgress) {
        this.deferredNextPreloadSongId = null;
        return;
      }
      this.clearNextTrackPreload();
      return;
    }
    // Fallback is using the warmer to load the CURRENT song — don't clobber
    // it. Park the request and apply it once the swap completes.
    if (this.warmerFallbackInProgress) {
      this.deferredNextPreloadSongId = nextSongId;
      return;
    }
    if (this.lastPreloadedSongId === nextSongId) return;

    const next = this.stationSongs().find((song) => song.id === nextSongId);
    const url = next?.['audioUrl'] as string | undefined;
    if (!url) return;

    const el = this.getPreloadAudio();
    if (!el) return;

    // Warmer must stay silent until promoted to speaker — without this, the
    // browser may emit audible playback once .play() runs in the swap path.
    el.muted = true;
    el.src = url;
    try { el.load(); } catch { /* ignore */ }
    this.lastPreloadedSongId = nextSongId;
  }

  private clearNextTrackPreload(): void {
    const el = this.getPreloadAudio();
    if (el) {
      el.removeAttribute('src');
      try { el.load(); } catch { /* ignore */ }
    }
    this.lastPreloadedSongId = null;
  }
}

// Shape returned by GET /api/v1/realtime/comments — raw Mongo documents
// use snake_case, and dates may come as ISO string or epoch ms depending on
// Mongoose serialization in the service.
interface RawComment {
  comment_event_id: string;
  song_id: string;
  station_id: string;
  user_id: string;
  username: string;
  profile_photo_url: string | null;
  content: string;
  mentions?: string[];
  likes_count?: number;
  created_at: string | number;
  session_version?: number;
}

interface HistoricalCommentsResponse {
  content: RawComment[];
  total: number;
  page: number;
  size: number;
}
