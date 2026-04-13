import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
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
export class OnboardingCompletePage {
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

  // =========================
  // PERSISTIR ONBOARDING COMPLETADO
  // =========================
  private persistOnboardingProgress(): void {
    const currentUser = this.authState.currentUser();
    if (!currentUser) return;

    const updatedCurrentUser: CurrentUser = {
      ...currentUser,
      onboardingCompleted: true,
      selectedStationIds: this.selectedStationIds(),
    };

    // Update session state — backend sync handled by auth adapter on next login
    this.authState.setCurrentUser(updatedCurrentUser);
  }

  // =========================
  // ESCUCHAR AHORA
  // Selecciona una estación random de las elegidas
  // =========================
  listenNow(): void {
    const selected = this.selectedStations();

    if (selected.length === 0) {
      window.location.href = '/user/home';
      return;
    }

    const randomIndex = Math.floor(Math.random() * selected.length);
    const randomStation = selected[randomIndex];

    window.location.href = `/user/station/${randomStation.id}`;
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
