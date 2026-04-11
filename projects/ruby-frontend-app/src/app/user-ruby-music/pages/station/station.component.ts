import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';

type HomeTab = 'TODAS' | 'MUSICA' | 'ESTACION';

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

interface StationCardView {
  id: string;
  name: string;
  gradientStart: string;
  gradientEnd: string;
  imageUrl: string | null;
  songCount: number;
  liveListeners: number;
}

@Component({
  selector: 'app-station',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './station.component.html',
  styleUrls: ['./station.component.scss'],
})
export class StationComponent {
  private readonly router = inject(Router);
  private readonly authState = inject(AuthState);

  private readonly STATIONS_KEY = 'ruby_stations';
  private readonly SONGS_KEY = 'ruby_songs';
  private readonly defaultStationImage = '/assets/icons/playlist-cover-placeholder.png';

  readonly currentUser = this.authState.currentUser;

  readonly stationsCatalog = signal<StoredStation[]>(
    this.loadStorageArray<StoredStation>(this.STATIONS_KEY)
  );

  readonly songsCatalog = signal<StoredSong[]>(
    this.loadStorageArray<StoredSong>(this.SONGS_KEY)
  );

  readonly allStations = computed<StationCardView[]>(() => {
    return this.stationsCatalog().map(station => this.mapStationToCard(station));
  });

  readonly favoriteStations = computed<StationCardView[]>(() => {
    const selectedIds = this.currentUser()?.selectedStationIds ?? [];
    if (!selectedIds.length) return [];

    const selectedIdSet = new Set(selectedIds);

    return this.stationsCatalog()
      .filter(station => selectedIdSet.has(station.id))
      .map(station => this.mapStationToCard(station));
  });

  /* ===================== */
  /* TABS */
  /* ===================== */
  setActiveTab(tab: HomeTab): void {
    if (tab === 'TODAS') {
      this.router.navigate(['/user/home']);
      return;
    }

    if (tab === 'MUSICA') {
      this.router.navigate(['/user/music']);
      return;
    }

    if (tab === 'ESTACION') {
      this.router.navigate(['/user/station']);
    }
  }

  isTabActive(tab: HomeTab): boolean {
    const currentUrl = this.router.url;

    if (tab === 'TODAS') {
      return currentUrl === '/user/home';
    }

    if (tab === 'MUSICA') {
      return currentUrl === '/user/music';
    }

    if (tab === 'ESTACION') {
      return currentUrl === '/user/station';
    }

    return false;
  }

  /* ===================== */
  /* NAVIGATION */
  /* ===================== */
  goToStationDetail(stationId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!stationId) return;

    this.router.navigate(['/user/station', stationId]);
  }

  /* ===================== */
  /* UI HELPERS */
  /* ===================== */
  getStationBackground(station: StationCardView): string {
    return `linear-gradient(180deg, ${station.gradientStart} 0%, ${station.gradientEnd} 100%)`;
  }

  getStationImage(station: StationCardView): string {
    return station.imageUrl || this.defaultStationImage;
  }

  trackByStation(_: number, station: StationCardView): string {
    return station.id;
  }

  /* ===================== */
  /* PRIVATE HELPERS */
  /* ===================== */
  private mapStationToCard(station: StoredStation): StationCardView {
    const firstSong = this.getFirstSongFromStation(station);

    return {
      id: station.id,
      name: station.name,
      gradientStart: station.gradientStart,
      gradientEnd: station.gradientEnd,
      imageUrl: firstSong?.coverUrl || null,
      songCount: station.songIds?.length ?? 0,
      liveListeners: station.liveListeners ?? 0,
    };
  }

  private getFirstSongFromStation(station: StoredStation): StoredSong | undefined {
    if (!station.songIds?.length) return undefined;

    const firstSongId = station.songIds[0];
    return this.songsCatalog().find(song => song.id === firstSongId);
  }

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
}