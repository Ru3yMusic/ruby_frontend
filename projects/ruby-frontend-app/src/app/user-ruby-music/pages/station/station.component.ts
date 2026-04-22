import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { LibraryState } from '../../state/library.state';

type HomeTab = 'TODAS' | 'MUSICA' | 'ESTACION';

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
export class StationComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authState = inject(AuthState);
  private readonly libraryState = inject(LibraryState);

  ngOnInit(): void {
    if (this.libraryState.stations().length === 0) {
      this.libraryState.loadActiveStations();
    }
    if (this.libraryState.songs().length === 0) {
      this.libraryState.loadRecentSongs();
    }
  }

  private readonly defaultStationImage = '/assets/icons/playlist-cover-placeholder.png';
  private readonly defaultGradientStart = '#1a1a2e';
  private readonly defaultGradientEnd = '#16213e';

  readonly currentUser = this.authState.currentUser;

  readonly allStations = computed<StationCardView[]>(() => {
    return this.libraryState.stations().map(station => this.mapStationToCard(station));
  });

  readonly favoriteStations = computed<StationCardView[]>(() => {
    const selectedIds = this.currentUser()?.selectedStationIds ?? [];
    if (!selectedIds.length) return [];

    const selectedIdSet = new Set(selectedIds);

    return this.libraryState.stations()
      .filter(station => selectedIdSet.has((station as any).id))
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
  private mapStationToCard(station: any): StationCardView {
    // Station songs approximated by genre match — StationResponse has no songIds[]
    const firstSong = this.libraryState.songs()
      .find(song => (song as any).genres?.some((g: any) => g?.id === station.genreId));

    return {
      id: station.id,
      name: station.name,
      gradientStart: station.gradientStart ?? this.defaultGradientStart,
      gradientEnd: station.gradientEnd ?? this.defaultGradientEnd,
      imageUrl: station.imageUrl ?? (firstSong as any)?.coverUrl ?? null,
      songCount: station.songCount ?? 0,
      liveListeners: station.listenerCount ?? 0,
    };
  }
}
