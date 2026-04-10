import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import {
  Menu,
  MicVocal,
  Music4,
  Play,
  TriangleAlert,
  Users,
} from 'lucide-angular';

import { LucideAngularModule } from 'lucide-angular';
import { AdminSidebarComponent } from '../../components/admin-sidebar/admin-sidebar.component';

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
export class DashboardPage {
  /* =========================
     STORAGE KEYS
  ========================== */
  private readonly USERS_KEY = 'ruby_users';
  private readonly REPORTS_KEY = 'ruby_reports';
  private readonly SONGS_KEY = 'ruby_songs';
  private readonly ARTISTS_KEY = 'ruby_artists';
  private readonly GENRES_KEY = 'ruby_genres';

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

  /* =========================
     DATA
  ========================== */
  readonly users = signal<AdminUser[]>(this.loadUsers());
  readonly reports = signal<ReportItem[]>(this.loadReports());
  readonly songs = signal<Song[]>(this.loadSongs());
  readonly artists = signal<Artist[]>(this.loadArtists());
  readonly genres = signal<Genre[]>(this.loadGenres());

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
     STORAGE
  ========================== */
  private loadUsers(): AdminUser[] {
    const stored = localStorage.getItem(this.USERS_KEY);

    if (!stored) return [];

    try {
      return JSON.parse(stored) as AdminUser[];
    } catch {
      localStorage.removeItem(this.USERS_KEY);
      return [];
    }
  }

  private loadReports(): ReportItem[] {
    const stored = localStorage.getItem(this.REPORTS_KEY);

    if (!stored) return [];

    try {
      return JSON.parse(stored) as ReportItem[];
    } catch {
      localStorage.removeItem(this.REPORTS_KEY);
      return [];
    }
  }

  private loadSongs(): Song[] {
    const stored = localStorage.getItem(this.SONGS_KEY);

    if (!stored) return [];

    try {
      return JSON.parse(stored) as Song[];
    } catch {
      localStorage.removeItem(this.SONGS_KEY);
      return [];
    }
  }

  private loadArtists(): Artist[] {
    const stored = localStorage.getItem(this.ARTISTS_KEY);

    if (!stored) return [];

    try {
      return JSON.parse(stored) as Artist[];
    } catch {
      localStorage.removeItem(this.ARTISTS_KEY);
      return [];
    }
  }

  private loadGenres(): Genre[] {
    const stored = localStorage.getItem(this.GENRES_KEY);

    if (!stored) return [];

    try {
      return JSON.parse(stored) as Genre[];
    } catch {
      localStorage.removeItem(this.GENRES_KEY);
      return [];
    }
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