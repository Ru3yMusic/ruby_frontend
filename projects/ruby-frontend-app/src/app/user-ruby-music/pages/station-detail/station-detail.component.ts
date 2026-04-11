import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { PlayerState } from '../../state/player.state';
import { PlaylistState } from '../../state/playlist.state';
import { NotificationsState } from '../../state/notifications.state';

interface StoredStation {
  id: string;
  name: string;
  genreId: string;
  songIds: string[];
  gradientStart: string;
  gradientEnd: string;
  liveListeners: number;
  createdAt: string;
}

interface StoredSong {
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

interface StoredArtist {
  id: string;
  name: string;
  photoUrl: string;
  bio: string;
  isTop: boolean;
  followersCount: string;
  monthlyListeners: string;
  createdAt: string;
}

interface StationComment {
  id: string;
  stationId: string;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  message: string;
  createdAt: string;
}

interface StationPresence {
  stationId: string;
  userId: string;
  enteredAt: string;
}

interface ReportItem {
  id: string;
  reportedUserId: string;
  reason: string;
  createdAt: string;
}

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
  private readonly authState = inject(AuthState);
  private readonly playlistState = inject(PlaylistState);
  private readonly playerState = inject(PlayerState);
  private readonly notificationsState = inject(NotificationsState);

  private readonly STATIONS_KEY = 'ruby_stations';
  private readonly SONGS_KEY = 'ruby_songs';
  private readonly ARTISTS_KEY = 'ruby_artists';
  private readonly COMMENTS_KEY = 'ruby_station_comments';
  private readonly PRESENCE_KEY = 'ruby_station_presence';
  private readonly REPORTS_KEY = 'ruby_reports';

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

  readonly stationsCatalog = signal<StoredStation[]>(
    this.loadStorageArray<StoredStation>(this.STATIONS_KEY)
  );

  readonly songsCatalog = signal<StoredSong[]>(
    this.loadStorageArray<StoredSong>(this.SONGS_KEY)
  );

  readonly artistsCatalog = signal<StoredArtist[]>(
    this.loadStorageArray<StoredArtist>(this.ARTISTS_KEY)
  );

  readonly stationComments = signal<StationComment[]>(
    this.loadStorageArray<StationComment>(this.COMMENTS_KEY)
  );

  readonly stationPresence = signal<StationPresence[]>(
    this.loadStorageArray<StationPresence>(this.PRESENCE_KEY)
  );

  readonly currentStationId = signal<string | null>(null);
  readonly currentSongIndex = signal(0);
  readonly messageInput = signal('');

  readonly currentTimeSeconds = signal(0);
  readonly durationSeconds = signal(0);

  readonly openCommentMenuId = signal<string | null>(null);

  readonly isReportModalOpen = signal(false);
  readonly selectedCommentForAction = signal<StationComment | null>(null);
  readonly replyTargetComment = signal<StationComment | null>(null);
  readonly selectedReportReason = signal('');

  readonly currentStation = computed(() => {
    const stationId = this.currentStationId();
    if (!stationId) return null;

    return this.stationsCatalog().find(station => station.id === stationId) ?? null;
  });

  readonly currentStationIndex = computed(() => {
    const stationId = this.currentStationId();
    if (!stationId) return -1;

    return this.stationsCatalog().findIndex(station => station.id === stationId);
  });

  readonly stationSongs = computed<StoredSong[]>(() => {
    const station = this.currentStation();
    if (!station) return [];

    return station.songIds
      .map(songId => this.songsCatalog().find(song => song.id === songId))
      .filter((song): song is StoredSong => !!song);
  });

  readonly currentSong = computed(() => {
    const songs = this.stationSongs();
    const index = this.currentSongIndex();

    if (!songs.length) return null;
    if (index < 0 || index >= songs.length) return songs[0];

    return songs[index];
  });

  readonly currentArtist = computed(() => {
    const song = this.currentSong();
    if (!song) return null;

    return this.artistsCatalog().find(artist => artist.id === song.artistId) ?? null;
  });

  readonly visibleComments = computed(() => {
    const stationId = this.currentStationId();
    if (!stationId) return [];

    return this.stationComments()
      .filter(comment => comment.stationId === stationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-4);
  });

  readonly commentsCount = computed(() => {
    const stationId = this.currentStationId();
    if (!stationId) return 0;

    return this.stationComments().filter(comment => comment.stationId === stationId).length;
  });

  readonly liveListenersCount = computed(() => {
    const station = this.currentStation();
    if (!station) return 0;

    const stationUserIds = new Set(
      this.stationPresence()
        .filter(item => item.stationId === station.id)
        .map(item => item.userId)
    );

    return (station.liveListeners ?? 0) + stationUserIds.size;
  });

  readonly currentSongLikesCount = computed(() => {
    const song = this.currentSong();
    if (!song) return 0;

    const refreshedSong = this.songsCatalog().find(item => item.id === song.id);
    return refreshedSong?.likesCount ?? 0;
  });

  readonly isCurrentSongLiked = computed(() => {
    const user = this.currentUser();
    const song = this.currentSong();

    if (!user?.id || !song?.id) return false;

    const likedPlaylist =
      this.playlistState.getLikedSongsPlaylist(user.id) ??
      this.playlistState.ensureLikedSongsPlaylist(user.id);

    return likedPlaylist.songIds.includes(song.id);
  });

  readonly currentTimeLabel = computed(() => this.formatTime(this.currentTimeSeconds()));
  readonly durationLabel = computed(() => this.formatTime(this.durationSeconds()));

  readonly progressPercent = computed(() => {
    const duration = this.durationSeconds();
    if (!duration) return 0;

    return (this.currentTimeSeconds() / duration) * 100;
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const nextStationId = params.get('id');
      if (!nextStationId) return;

      const previousStationId = this.currentStationId();

      if (previousStationId && previousStationId !== nextStationId) {
        this.removeCurrentUserPresence(previousStationId);
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

      this.registerCurrentUserPresence(nextStationId);
      this.startCurrentSongIfReady();
    });
  }

  ngAfterViewInit(): void {
    this.startCurrentSongIfReady();
  }

  ngOnDestroy(): void {
    const stationId = this.currentStationId();
    if (stationId) {
      this.removeCurrentUserPresence(stationId);
    }

    this.pauseAudio();
  }

  /* ===================== */
  /* AUDIO / PLAYER */
  /* ===================== */
  startCurrentSongIfReady(): void {
    const song = this.currentSong();
    const audio = this.stationAudioRef?.nativeElement;

    if (!song || !audio) return;

    this.syncSharedPlayer(song);

    audio.src = song.audioUrl;
    audio.currentTime = 0;
    audio.load();

    const playPromise = audio.play();
    if (playPromise instanceof Promise) {
      playPromise.catch(() => {
        // bloqueo de autoplay del navegador
      });
    }
  }

  private syncSharedPlayer(song: StoredSong): void {
    this.playerState.playSong(song);
    this.playerState.pause();
    this.playerState.setCurrentTime(0);
    this.playerState.setDuration(song.durationSeconds || 0);
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
    const audio = this.stationAudioRef?.nativeElement;
    if (!audio) return;

    audio.pause();
  }

  /* ===================== */
  /* STATION NAVIGATION */
  /* ===================== */
  goToPreviousStation(): void {
    const stations = this.stationsCatalog();
    const currentIndex = this.currentStationIndex();

    if (!stations.length || currentIndex === -1) return;

    const previousIndex = (currentIndex - 1 + stations.length) % stations.length;
    this.router.navigate(['/user/station', stations[previousIndex].id]);
  }

  goToNextStation(): void {
    const stations = this.stationsCatalog();
    const currentIndex = this.currentStationIndex();

    if (!stations.length || currentIndex === -1) return;

    const nextIndex = (currentIndex + 1) % stations.length;
    this.router.navigate(['/user/station', stations[nextIndex].id]);
  }

  /* ===================== */
  /* COMMENTS */
  /* ===================== */
  sendComment(): void {
    const stationId = this.currentStationId();
    const station = this.currentStation();
    const user = this.currentUser();
    const message = this.messageInput().trim();
    const replyTarget = this.replyTargetComment();

    if (!stationId || !station || !user?.id || !message) return;

    const newComment: StationComment = {
      id: this.generateId('station-comment'),
      stationId,
      userId: user.id,
      userName: user.name,
      userAvatarUrl: user.avatarUrl ?? null,
      message,
      createdAt: new Date().toISOString(),
    };

    const updated = [...this.stationComments(), newComment];
    this.stationComments.set(updated);
    localStorage.setItem(this.COMMENTS_KEY, JSON.stringify(updated));

    if (replyTarget && replyTarget.userId !== user.id) {
      this.createNotification({
        userId: replyTarget.userId,
        type: 'STATION_REPLY',
        title: `${user.name} respondió tu comentario`,
        message: `${user.name} te respondió en la estación "${station.name}"`,
        meta: {
          stationId: station.id,
          stationName: station.name,
          actorUserId: user.id,
          actorUserName: user.name,
          commentId: newComment.id,
        },
      });
    }

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

  getCommentAvatar(comment: StationComment): string {
    return comment.userAvatarUrl || this.defaultAvatar;
  }

  /* ===================== */
  /* COMMENT MENU ACTIONS */
  /* ===================== */
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

  replyToComment(comment: StationComment, event?: MouseEvent): void {
    event?.stopPropagation();

    this.replyTargetComment.set(comment);
    this.messageInput.set(`@${comment.userName} `);
    this.closeCommentMenu();
  }

  connectWithUser(comment: StationComment, event?: MouseEvent): void {
    event?.stopPropagation();

    const currentUser = this.currentUser();
    if (!currentUser?.id) return;

    if (comment.userId === currentUser.id) {
      this.closeCommentMenu();
      return;
    }

    this.notificationsState.createFriendRequest({
      requesterUserId: currentUser.id,
      requesterName: currentUser.name,
      requesterAvatarUrl: currentUser.avatarUrl ?? null,
      addresseeUserId: comment.userId,
    });

    this.closeCommentMenu();
  }

  openReportModal(comment: StationComment, event?: MouseEvent): void {
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
    const selectedComment = this.selectedCommentForAction();
    const reason = this.selectedReportReason().trim();

    if (!selectedComment || !reason) return;

    const currentReports = this.loadStorageArray<ReportItem>(this.REPORTS_KEY);

    const newReport: ReportItem = {
      id: this.generateId('report'),
      reportedUserId: selectedComment.userId,
      reason,
      createdAt: new Date().toISOString(),
    };

    const updatedReports = [...currentReports, newReport];
    localStorage.setItem(this.REPORTS_KEY, JSON.stringify(updatedReports));

    this.closeReportModal();
  }

  /* ===================== */
  /* LIKES (CANCIÓN ACTUAL) */
  /* ===================== */
  toggleCurrentSongLike(): void {
    const user = this.currentUser();
    const song = this.currentSong();

    if (!user?.id || !song?.id) return;

    if (this.isCurrentSongLiked()) {
      this.playlistState.removeSongFromLikedSongs(user.id, song.id);
      this.updateSongLikesCount(song.id, -1);
      this.syncSharedPlayerAfterLike(song.id);
      return;
    }

    this.playlistState.addSongToLikedSongs(user.id, song.id);
    this.updateSongLikesCount(song.id, 1);
    this.syncSharedPlayerAfterLike(song.id);
  }

  private updateSongLikesCount(songId: string, delta: number): void {
    const updatedSongs = this.songsCatalog().map(song => {
      if (song.id !== songId) return song;

      return {
        ...song,
        likesCount: Math.max(0, (song.likesCount ?? 0) + delta),
      };
    });

    this.songsCatalog.set(updatedSongs);
    localStorage.setItem(this.SONGS_KEY, JSON.stringify(updatedSongs));
  }

  private syncSharedPlayerAfterLike(songId: string): void {
    const refreshedSong = this.songsCatalog().find(song => song.id === songId);
    if (!refreshedSong) return;

    this.playerState.playSong(refreshedSong);
    this.playerState.pause();
    this.playerState.setCurrentTime(this.currentTimeSeconds());
    this.playerState.setDuration(this.durationSeconds());
  }

  /* ===================== */
  /* PRESENCE / LISTENERS */
  /* ===================== */
  private registerCurrentUserPresence(stationId: string): void {
    const user = this.currentUser();
    if (!user?.id) return;

    const cleaned = this.stationPresence().filter(item => item.userId !== user.id);

    const newPresence: StationPresence = {
      stationId,
      userId: user.id,
      enteredAt: new Date().toISOString(),
    };

    const updated = [...cleaned, newPresence];
    this.stationPresence.set(updated);
    localStorage.setItem(this.PRESENCE_KEY, JSON.stringify(updated));
  }

  private removeCurrentUserPresence(stationId: string): void {
    const user = this.currentUser();
    if (!user?.id) return;

    const updated = this.stationPresence().filter(
      item => !(item.userId === user.id && item.stationId === stationId)
    );

    this.stationPresence.set(updated);
    localStorage.setItem(this.PRESENCE_KEY, JSON.stringify(updated));
  }

  /* ===================== */
  /* UI HELPERS */
  /* ===================== */
  goBack(): void {
    this.router.navigate(['/user/station']);
  }

  goToArtistDetail(): void {
    const artist = this.currentArtist();
    if (!artist?.id) return;

    this.router.navigate(['/user/artist', artist.id]);
  }

  getStationBackgroundStyle(): string {
    const station = this.currentStation();
    if (!station) {
      return 'linear-gradient(180deg, #1d1d1d 0%, #090909 100%)';
    }

    return `linear-gradient(180deg, ${station.gradientStart} 0%, ${station.gradientEnd} 100%)`;
  }

  getBackdropImage(): string {
    return this.currentSong()?.coverUrl || this.defaultCover;
  }

  getCurrentArtistPhoto(): string {
    return this.currentArtist()?.photoUrl || this.defaultAvatar;
  }

  /* ===================== */
  /* NOTIFICATIONS */
  /* ===================== */
  private createNotification(payload: {
    userId: string;
    type: 'STATION_REPLY' | 'FRIEND_REQUEST';
    title: string;
    message: string;
    meta: {
      stationId?: string;
      stationName?: string;
      actorUserId?: string;
      actorUserName?: string;
      commentId?: string;
    };
  }): void {
    this.notificationsState.createNotification(payload);
  }

  /* ===================== */
  /* STORAGE HELPERS */
  /* ===================== */
  private loadStorageArray<T>(storageKey: string): T[] {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }

  private generateId(prefix: string): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `${prefix}-${crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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