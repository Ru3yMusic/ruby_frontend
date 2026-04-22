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
import { PlayerState, PlayerSong } from '../../state/player.state';
import { LibraryState } from '../../state/library.state';
import { InteractionState } from '../../state/interaction.state';
import { FriendsState } from '../../state/friends.state';

@Component({
  selector: 'app-station-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './station-detail.component.html',
  styleUrls: ['./station-detail.component.scss'],
})
export class StationDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('stationAudio') stationAudioRef?: ElementRef<HTMLAudioElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authState = inject(AuthState);
  private readonly libraryState = inject(LibraryState);
  private readonly interactionState = inject(InteractionState);
  private readonly friendsState = inject(FriendsState);
  private readonly playerState = inject(PlayerState);
  private readonly realtimePort = inject(RealtimePort);
  private readonly reportsApi = inject(ReportsApi);
  private readonly usersApi = inject(UsersApi);
  private readonly http = inject(HttpClient);
  private readonly gatewayUrl = inject(API_GATEWAY_URL);

  /**
   * Lazy cache: userId → avatar URL resolved from auth-service.
   * Needed because the JWT intentionally omits profilePhotoUrl (size limit),
   * so realtime-ws-ms persists comments with profile_photo_url: null. We fall
   * back to usersApi.getUserById on demand per unique author.
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
    this.presenceHeartbeatHandle = setInterval(() => {
      this.realtimePort.pingPresence();
    }, 60_000);

    this.route.paramMap.subscribe(params => {
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
      this.openCommentMenuId.set(null);
      this.isReportModalOpen.set(false);
      this.selectedCommentForAction.set(null);
      this.replyTargetComment.set(null);
      this.selectedReportReason.set('');
      this.stationComments.set([]);
      this.liveListenersCount.set(0);
      this.loadStationSongs(nextStationId);
    });
  }

  ngAfterViewInit(): void {
    this.startCurrentSongIfReady();
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
    // Al salir de station-detail conservamos la canción en el estado global
    // y sólo la dejamos en pausa, para que el footer la muestre pausada en
    // vez de caer en "Sin reproducción".
    this.playerState.pause();
  }

  private subscribeToRealtimeEvents(): void {
    // Incoming comments — dedupe by commentId since the same message may arrive
    // both from the historical HTTP load and from the WS broadcast in race
    // scenarios (self-echo right after sending, or a listener joining mid-flight).
    this.realtimePort.onNewComment()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(comment => {
        this.stationComments.update(list => {
          if (list.some(c => c.commentId === comment.commentId)) return list;
          return [...list, comment];
        });
        this.preloadAvatars([comment]);
      });

    // Listener count from joined_station ack
    this.realtimePort.onJoinedStation()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(payload => {
        if (payload.stationId === this.currentStationId()) {
          this.liveListenersCount.set(payload.listenerCount);
        }
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
          // Realtime join se dispara solo cuando ya hay canción activa real
          const song = this.currentSong();
          const songId = (song?.['id'] as string | undefined) ?? '';
          if (songId) {
            this.loadHistoricalComments(stationId, songId);
            this.realtimePort.joinStation(stationId, songId);
          }
          this.startCurrentSongIfReady();
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
    const url = `${this.gatewayUrl}/api/v1/realtime/comments`;
    const params = { songId, stationId, sort: 'recent', page: '0', size: '20' };

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

          this.stationComments.update((list) => {
            const seen = new Set(list.map((c) => c.commentId));
            const toPrepend = historical.filter((c) => !seen.has(c.commentId));
            return [...toPrepend, ...list];
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
  });

  // ─── Audio / Player ───────────────────────────────────────────────────────

  startCurrentSongIfReady(): void {
    const song = this.currentSong();
    const audio = this.stationAudioRef?.nativeElement;
    if (!song || !audio) return;

    this.syncSharedPlayer(song);

    audio.src = (song['audioUrl'] as string | undefined) ?? '';
    audio.currentTime = 0;
    audio.load();

    const playPromise = audio.play();
    if (playPromise instanceof Promise) {
      playPromise.catch(() => { /* browser autoplay policy */ });
    }
  }

  private syncSharedPlayer(song: SongResponse): void {
    const playerSong: PlayerSong = {
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
    this.playerState.playSong(playerSong);
    this.playerState.setDuration(playerSong.durationSeconds);
  }

  playNextSong(): void {
    const songs = this.stationSongs();
    if (!songs.length) return;
    const nextIndex = (this.currentSongIndex() + 1) % songs.length;
    this.currentSongIndex.set(nextIndex);
    this.currentTimeSeconds.set(0);
    this.durationSeconds.set(0);
    this.startCurrentSongIfReady();
  }

  onAudioLoadedMetadata(): void {
    const audio = this.stationAudioRef?.nativeElement;
    if (!audio) return;
    const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
    this.durationSeconds.set(nextDuration);
    this.playerState.setDuration(nextDuration);
  }

  onAudioTimeUpdate(): void {
    const audio = this.stationAudioRef?.nativeElement;
    if (!audio) return;
    const nextTime = audio.currentTime ?? 0;
    this.currentTimeSeconds.set(nextTime);
    this.playerState.setCurrentTime(nextTime);
  }

  onAudioEnded(): void {
    this.playNextSong();
  }

  onAudioPlay(): void {
    this.playerState.setPlaying(true);
  }

  onAudioPause(): void {
    this.playerState.setPlaying(false);
  }

  private pauseAudio(): void {
    this.stationAudioRef?.nativeElement?.pause();
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
      commentId: crypto.randomUUID(),
      songId: song['id'] as string,
      stationId,
      content: message,
      mentions,
    });

    this.messageInput.set('');
    this.replyTargetComment.set(null);
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
   * Fires one auth-service lookup per unique userId that isn't in the cache
   * yet. Called OUTSIDE of template rendering, from places where the comment
   * list is mutated (historical HTTP load + WS onNewComment). Safe to call
   * repeatedly — the "already in cache" short-circuit avoids duplicate
   * requests.
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

    for (const userId of pending) {
      this.usersApi
        .getUserById(userId)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          catchError(() => of<UserResponse | null>(null)),
        )
        .subscribe((user) => {
          this._userAvatars.update((map) => ({
            ...map,
            [userId]: user?.profilePhotoUrl ?? null,
          }));
        });
    }
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
}

interface HistoricalCommentsResponse {
  content: RawComment[];
  total: number;
  page: number;
  size: number;
}
