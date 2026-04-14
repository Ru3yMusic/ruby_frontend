import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  Menu,
  MicVocal,
  Music4,
  Play,
  TriangleAlert,
  Users,
} from 'lucide-angular';
import { forkJoin } from 'rxjs';

import { LucideAngularModule } from 'lucide-angular';
import { AdminSidebarComponent } from '../../components/admin-sidebar/admin-sidebar.component';
import {
  ArtistResponse,
  ArtistsApi,
  GenreResponse,
  GenresApi,
  SongResponse,
  SongsApi,
} from 'lib-ruby-sdks/catalog-service';
import { UserResponse, UsersApi } from 'lib-ruby-sdks/auth-service';
import { ReportTargetSummary, ReportsApi } from 'lib-ruby-sdks/social-service';

/* =========================
   MODELOS BASE
========================= */
type UserStatus = 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  status: UserStatus;
  createdAt: string;
  reportCount: number;
  blockReason: string | null;
  blockedAt: string | null;
}

interface ReportItem {
  id: string;
  reportedUserId: string;
  reason: string;
  createdAt: string;
}

interface Artist {
  id: string;
  name: string;
  photoUrl: string;
  bio: string;
  isTop: boolean;
  followersCount: string;
  monthlyListeners: string;
  createdAt: string;
}

interface Genre {
  id: string;
  name: string;
  count: number;
  createdAt: string;
  gradientStart: string;
  gradientEnd: string;
}

interface Song {
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

/* =========================
   MODELOS UI
========================= */
interface GenreDistributionItem {
  id: string;
  name: string;
  songCount: number;
  percentage: number;
  gradientStart: string;
  gradientEnd: string;
}

interface OtherGenresSummary {
  remainingCount: number;
  songCount: number;
  percentage: number;
}

interface SeverityStats {
  lowCount: number;
  mediumCount: number;
  criticalCount: number;
  lowPercentage: number;
  mediumPercentage: number;
  criticalPercentage: number;
}

interface LatestUserItem {
  id: string;
  name: string;
  avatarUrl: string;
  formattedDate: string;
}

interface LatestSongItem {
  id: string;
  title: string;
  artistName: string;
  coverUrl: string;
  playCountLabel: string;
}

/* =========================
   COMPONENTE
========================= */
@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, AdminSidebarComponent],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage implements OnInit {
  /* =========================
     SERVICIOS
  ========================== */
  private readonly usersApi = inject(UsersApi);
  private readonly songsApi = inject(SongsApi);
  private readonly artistsApi = inject(ArtistsApi);
  private readonly genresApi = inject(GenresApi);
  private readonly reportsApi = inject(ReportsApi);

  /* =========================
     ICONOS
  ========================== */
  readonly Menu = Menu;
  readonly Users = Users;
  readonly TriangleAlert = TriangleAlert;
  readonly Music4 = Music4;
  readonly MicVocal = MicVocal;
  readonly Play = Play;

  /* =========================
     UI STATE
  ========================== */
  readonly sidebarOpen = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /* =========================
     DATA
  ========================== */
  readonly users = signal<AdminUser[]>([]);
  readonly reports = signal<ReportItem[]>([]);
  readonly songs = signal<Song[]>([]);
  readonly artists = signal<Artist[]>([]);
  readonly genres = signal<Genre[]>([]);

  /* =========================
     LIFECYCLE
  ========================== */
  ngOnInit(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      users: this.usersApi.listUsers(),
      songs: this.songsApi.listSongs(),
      artists: this.artistsApi.listArtists(),
      genres: this.genresApi.listGenres(),
      reports: this.reportsApi.listGroupedReports(),
    }).subscribe({
      next: ({ users, songs, artists, genres, reports }) => {
        this.users.set(this.mapUsers(users.content ?? []));
        this.songs.set(this.mapSongs(songs.content ?? []));
        this.artists.set(this.mapArtists(artists.content ?? []));
        this.genres.set(this.mapGenres(genres));
        this.reports.set(this.mapGroupedReports(reports));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al cargar los datos del dashboard');
        this.loading.set(false);
      },
    });
  }

  /* =========================
     KPI CARDS
  ========================== */
  readonly totalActiveUsers = computed(() => {
    return this.users().filter((user) => user.status === 'ACTIVO').length;
  });

  readonly totalPendingReports = computed(() => {
    const pendingUserIds = new Set(this.reports().map((report) => report.reportedUserId));
    return pendingUserIds.size;
  });

  readonly totalSongs = computed(() => {
    return this.songs().length;
  });

  readonly totalArtists = computed(() => {
    return this.artists().length;
  });

  /* =========================
     DISTRIBUCION POR GENERO
  ========================== */
  readonly topGenreDistribution = computed<GenreDistributionItem[]>(() => {
    const songs = this.songs();
    const genres = this.genres();

    if (songs.length === 0 || genres.length === 0) {
      return [];
    }

    const distribution = genres
      .map((genre) => {
        const songCount = songs.filter((song) => song.genreId === genre.id).length;
        const percentage = Math.round((songCount / songs.length) * 100);

        return {
          id: genre.id,
          name: genre.name,
          songCount,
          percentage,
          gradientStart: genre.gradientStart,
          gradientEnd: genre.gradientEnd,
        };
      })
      .filter((genre) => genre.songCount > 0)
      .sort((a, b) => b.songCount - a.songCount);

    return distribution.slice(0, 5);
  });

  readonly otherGenresSummary = computed<OtherGenresSummary | null>(() => {
    const songs = this.songs();
    const genres = this.genres();

    if (songs.length === 0 || genres.length === 0) {
      return null;
    }

    const distribution = genres
      .map((genre) => {
        const songCount = songs.filter((song) => song.genreId === genre.id).length;

        return {
          id: genre.id,
          songCount,
        };
      })
      .filter((genre) => genre.songCount > 0)
      .sort((a, b) => b.songCount - a.songCount);

    const remaining = distribution.slice(5);

    if (remaining.length === 0) {
      return null;
    }

    const songCount = remaining.reduce((acc, item) => acc + item.songCount, 0);
    const percentage = Math.round((songCount / songs.length) * 100);

    return {
      remainingCount: remaining.length,
      songCount,
      percentage,
    };
  });

  /* =========================
     REPORTES DE GRAVEDAD
     SALE DESDE users.reportCount
  ========================== */
  readonly severityStats = computed<SeverityStats>(() => {
    const usersWithReports = this.users().filter((user) => (user.reportCount ?? 0) > 0);

    const totalCases = usersWithReports.length;

    const lowCount = usersWithReports.filter((user) => user.reportCount === 1).length;
    const mediumCount = usersWithReports.filter((user) => user.reportCount === 2).length;
    const criticalCount = usersWithReports.filter((user) => user.reportCount >= 3).length;

    const toPercent = (value: number): number => {
      if (totalCases === 0) return 0;
      return Math.round((value / totalCases) * 100);
    };

    return {
      lowCount,
      mediumCount,
      criticalCount,
      lowPercentage: toPercent(lowCount),
      mediumPercentage: toPercent(mediumCount),
      criticalPercentage: toPercent(criticalCount),
    };
  });

  /* =========================
     DONUT
  ========================== */
  readonly donutBackground = computed(() => {
    const stats = this.severityStats();

    const low = stats.lowPercentage;
    const medium = stats.mediumPercentage;
    const critical = stats.criticalPercentage;

    if (low === 0 && medium === 0 && critical === 0) {
      return 'conic-gradient(#e5e5e5 0% 100%)';
    }

    const mediumEnd = low + medium;
    const criticalEnd = low + medium + critical;

    return `conic-gradient(
      #f1ea00 0% ${low}%,
      #c97a15 ${low}% ${mediumEnd}%,
      #d10000 ${mediumEnd}% ${criticalEnd}%,
      #e5e5e5 ${criticalEnd}% 100%
    )`;
  });

  /* =========================
     ULTIMOS USUARIOS
  ========================== */
  readonly latestUsers = computed<LatestUserItem[]>(() => {
    return [...this.users()]
      .sort((a, b) => this.parseDateToTime(b.createdAt) - this.parseDateToTime(a.createdAt))
      .slice(0, 5)
      .map((user) => ({
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        formattedDate: this.formatShortDate(user.createdAt),
      }));
  });

  /* =========================
     ULTIMAS CANCIONES
  ========================== */
  readonly latestSongs = computed<LatestSongItem[]>(() => {
    const artists = this.artists();

    return [...this.songs()]
      .sort((a, b) => this.parseDateToTime(b.createdAt) - this.parseDateToTime(a.createdAt))
      .slice(0, 5)
      .map((song) => {
        const artist = artists.find((item) => item.id === song.artistId);

        return {
          id: song.id,
          title: song.title,
          artistName: artist?.name ?? 'Artista no disponible',
          coverUrl: song.coverUrl,
          playCountLabel: this.formatCompactCount(song.playCount),
        };
      });
  });

  /* =========================
     MAPPERS SDK → LOCAL
  ========================== */
  private mapUsers(sdkUsers: UserResponse[]): AdminUser[] {
    return sdkUsers.map((u) => ({
      id: u.id ?? '',
      name: u.displayName ?? u.email ?? '',
      email: u.email ?? '',
      avatarUrl: u.profilePhotoUrl ?? '',
      status: this.mapUserStatus(u.status),
      createdAt: u.createdAt ?? '',
      reportCount: 0,
      blockReason: u.blockReason ?? null,
      blockedAt: null,
    }));
  }

  private mapUserStatus(status?: string): UserStatus {
    switch (status) {
      case 'ACTIVE': return 'ACTIVO';
      case 'INACTIVE': return 'INACTIVO';
      case 'BLOCKED': return 'BLOQUEADO';
      default: return 'ACTIVO';
    }
  }

  private mapSongs(sdkSongs: SongResponse[]): Song[] {
    return sdkSongs.map((s) => ({
      id: s.id ?? '',
      title: s.title ?? '',
      artistId: s.artist?.id ?? '',
      albumId: s.album?.id ?? null,
      genreId: s.genres?.[0]?.id ?? '',
      coverUrl: s.coverUrl ?? '',
      audioUrl: s.audioUrl ?? '',
      durationSeconds: s.duration ?? 0,
      lyrics: s.lyrics ?? null,
      playCount: s.playCount ?? 0,
      likesCount: s.likesCount ?? 0,
      createdAt: '',
    }));
  }

  private mapArtists(sdkArtists: ArtistResponse[]): Artist[] {
    return sdkArtists.map((a) => ({
      id: a.id ?? '',
      name: a.name ?? '',
      photoUrl: a.photoUrl ?? '',
      bio: a.bio ?? '',
      isTop: a.isTop ?? false,
      followersCount: `${a.followersCount ?? 0} seguidores`,
      monthlyListeners: `${a.monthlyListeners ?? 0} oyentes`,
      createdAt: a.createdAt ?? '',
    }));
  }

  private mapGenres(sdkGenres: GenreResponse[]): Genre[] {
    return sdkGenres.map((g) => ({
      id: g.id ?? '',
      name: g.name ?? '',
      count: g.songCount ?? 0,
      createdAt: g.createdAt ?? '',
      gradientStart: g.gradientStart ?? '#000000',
      gradientEnd: g.gradientEnd ?? '#000000',
    }));
  }

  private mapGroupedReports(sdkReports: ReportTargetSummary[]): ReportItem[] {
    return sdkReports.map((r) => ({
      id: r.targetId ?? '',
      reportedUserId: r.targetId ?? '',
      reason: r.targetType ?? '',
      createdAt: r.latestReportAt ?? '',
    }));
  }

  /* =========================
     HELPERS
  ========================== */
  private parseDateToTime(value: string): number {
    if (!value) return 0;

    // Soporte para ISO: 2026-04-07T09:20:20.612Z
    const isoDate = new Date(value);
    if (!Number.isNaN(isoDate.getTime())) {
      return isoDate.getTime();
    }

    // Soporte para formato DD/MM/AAAA
    const parts = value.split('/').map(Number);
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return new Date(year, month - 1, day).getTime();
    }

    return 0;
  }

  private formatCompactCount(value: number): string {
    if (value >= 1_000_000) {
      const formatted = value / 1_000_000;
      return `${formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1)} M`;
    }

    if (value >= 1_000) {
      const formatted = value / 1_000;
      return `${formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1)}k`;
    }

    return `${value}`;
  }

  private formatShortDate(value: string): string {
    if (!value) return '';

    const monthMap: Record<string, string> = {
      '01': 'Ene',
      '02': 'Feb',
      '03': 'Mar',
      '04': 'Abr',
      '05': 'May',
      '06': 'Jun',
      '07': 'Jul',
      '08': 'Ago',
      '09': 'Sep',
      '10': 'Oct',
      '11': 'Nov',
      '12': 'Dic',
    };

    const isoDate = new Date(value);
    if (!Number.isNaN(isoDate.getTime())) {
      const day = String(isoDate.getDate()).padStart(2, '0');
      const month = String(isoDate.getMonth() + 1).padStart(2, '0');
      return `${day}/${monthMap[month] ?? month}`;
    }

    const parts = value.split('/');
    if (parts.length >= 2) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      return `${day}/${monthMap[month] ?? month}`;
    }

    return value;
  }
}
