import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { AuthState, CurrentUser } from '../../../auth/state/auth.state';
import { LibraryState } from '../../../../user-ruby-music/state/library.state';

interface StationUI {
  id: string;
  name: string;
  gradientStart: string;
  gradientEnd: string;
}

@Component({
  selector: 'app-onboarding-complete-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './onboarding-complete.page.html',
  styleUrl: './onboarding-complete.page.scss',
})
export class OnboardingCompletePage implements OnInit {
  private readonly authState = inject(AuthState);
  private readonly libraryState = inject(LibraryState);

  // IDs seleccionados en el step anterior
  readonly selectedStationIds = this.authState.selectedStations;

  // Estaciones seleccionadas completas para mostrar en pantalla
  readonly selectedStations = computed<StationUI[]>(() => {
    const ids = this.selectedStationIds();
    return this.libraryState.stations()
      .filter(station => ids.includes((station as any).id))
      .map(station => this.toStationUI(station));
  });

  constructor() {
    this.persistOnboardingProgress();
  }

  ngOnInit(): void {
    // Si llegamos aquí tras un full-reload, libraryState.stations() está vacío.
    // Recargar estaciones activas para que "Escuchar ahora" encuentre IDs reales.
    if (this.libraryState.stations().length === 0) {
      this.libraryState.loadActiveStations();
    }
  }

  // =========================
  // PERSISTIR ONBOARDING COMPLETADO
  // =========================
  private persistOnboardingProgress(): void {
    const currentUser = this.authState.currentUser();
    if (!currentUser) return;

    const stationIds = this.selectedStationIds();

    const updatedCurrentUser: CurrentUser = {
      ...currentUser,
      onboardingCompleted: true,
      selectedStationIds: stationIds,
    };

    this.authState.setCurrentUser(updatedCurrentUser);
    // Persistir flag por userId para que sobreviva al logout.
    this.authState.markOnboardingCompleted(currentUser.id, stationIds);
  }

  // =========================
  // ESCUCHAR AHORA
  // Selecciona una estación random de las elegidas
  // =========================
  listenNow(): void {
    // Preferimos IDs persistidos (sobreviven a full-reload);
    // caemos a los resueltos desde libraryState si están disponibles.
    const persistedIds = this.selectedStationIds();
    const pool = persistedIds.length > 0
      ? persistedIds
      : this.selectedStations().map(s => s.id);

    if (pool.length === 0) {
      window.location.href = '/user/home';
      return;
    }

    const randomId = pool[Math.floor(Math.random() * pool.length)];
    window.location.href = `/user/station/${randomId}`;
  }

  // =========================
  // AHORA NO
  // Va directo al home
  // =========================
  skip(): void {
    window.location.href = '/user/home';
  }

  // =========================
  // HELPERS
  // =========================
  private toStationUI(station: any): StationUI {
    return {
      id: station.id,
      name: station.name,
      gradientStart: station.gradientStart ?? '#1a1a2e',
      gradientEnd: station.gradientEnd ?? '#16213e',
    };
  }
}
