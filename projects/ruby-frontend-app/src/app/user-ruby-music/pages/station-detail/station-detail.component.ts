import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { RealtimePort, WsCommentPayload } from 'lib-ruby-core';
import { SongResponse, StationResponse, ArtistResponse } from 'lib-ruby-sdks/catalog-service';
import { ReportsApi, ReportTargetType } from 'lib-ruby-sdks/social-service';
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
    return this.stationComments()
      .filter(c => c.stationId === stationId)
      .slice(-4);
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
    return (song?.['likesCount'] as number | undefined) ?? 0;
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
    this.libraryState.loadTopArtists();

    // Subscribe to realtime streams (auto-unsubscribed on component destroy)
    this.subscribeToRealtimeEvents();

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

      // Join station room via Socket.IO
      const song = this.currentSong();
      const songId = (song?.['id'] as string | undefined) ?? '';
      if (songId) {
        this.realtimePort.joinStation(nextStationId, songId);
      }

      this.startCurrentSongIfReady();
    });
  }

  ngAfterViewInit(): void {
    this.startCurrentSongIfReady();
  }

  ngOnDestroy(): void {
    const stationId = this.currentStationId();
    if (stationId) {
      this.realtimePort.leaveStation();
    }
    this.pauseAudio();
  }

  private subscribeToRealtimeEvents(): void {
    // Incoming comments
    this.realtimePort.onNewComment()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(comment => {
        this.stationComments.update(list => [...list, comment]);
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
  }

  // ─── Station Songs ────────────────────────────────────────────────────────

  private loadStationSongs(stationId: string): void {
    this._stationSongs.set([]);
    this.libraryState.getSongsByStation(stationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (songs) => this._stationSongs.set(songs),
        error: () => this._stationSongs.set([]),
      });
  }

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
      albumId: song.album?.id ?? null,
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
    this.playerState.pause();
    this.playerState.setCurrentTime(0);
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

    this.realtimePort.sendComment({
      commentId: crypto.randomUUID(),
      songId: song['id'] as string,
      stationId,
      content: message,
      mentions: [],
    });

    this.messageInput.set('');
    this.replyTargetComment.set(null);
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

  getCommentAvatar(comment: WsCommentPayload): string {
    return comment.profilePhotoUrl ?? this.defaultAvatar;
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
    this.friendsState.sendFriendRequest(comment.userId);
    this.closeCommentMenu();
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
    if (!songId) return;
    this.interactionState.toggleLike(songId);
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
