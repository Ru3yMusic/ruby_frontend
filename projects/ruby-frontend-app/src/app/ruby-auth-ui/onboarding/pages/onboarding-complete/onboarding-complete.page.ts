import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthState, CurrentUser } from '../../../auth/state/auth.state';

interface StationUI {
  id: string;
  name: string;
  gradientStart: string;
  gradientEnd: string;
}

interface AuthUser {
  id: string;
  email: string;
  password: string;
  authProvider: 'EMAIL';
  name: string;
  birthDate: string;
  gender: string;
  avatarUrl: string | null;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'BLOCKED' | 'INACTIVE';
  blockReason: string | null;
  blockedAt: string | null;
  onboardingCompleted: boolean;
  selectedStationIds: string[];
  createdAt: string;
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

  private readonly AUTH_USERS_KEY = 'ruby_auth_users';

  // Lista completa de estaciones cargadas desde localStorage
  readonly stations = signal<StationUI[]>([]);

  // IDs seleccionados en el step anterior
  readonly selectedStationIds = this.authState.selectedStations;

  // Estaciones seleccionadas completas para mostrar en pantalla
  readonly selectedStations = computed(() => {
    const ids = this.selectedStationIds();
    return this.stations().filter(station => ids.includes(station.id));
  });

  constructor() {
    this.loadStations();
    this.persistOnboardingProgress();
  }

  // =========================
  // CARGAR ESTACIONES DESDE LOCALSTORAGE
  // =========================
  private loadStations(): void {
    const raw = localStorage.getItem('ruby_stations');

    if (!raw) {
      this.stations.set([]);
      return;
    }

    try {
      const parsed = JSON.parse(raw);

      const mapped: StationUI[] = parsed.map((station: any) => ({
        id: station.id,
        name: station.name,
        gradientStart: station.gradientStart,
        gradientEnd: station.gradientEnd,
      }));

      this.stations.set(mapped);
    } catch (error) {
      console.error('Error leyendo estaciones en onboarding-complete:', error);
      this.stations.set([]);
    }
  }

  // =========================
  // PERSISTIR ONBOARDING COMPLETADO
  // =========================
  private persistOnboardingProgress(): void {
    const currentUser = this.authState.currentUser();
    if (!currentUser) return;

    const authUsers = this.loadAuthUsers();
    const index = authUsers.findIndex(user => user.id === currentUser.id);

    if (index === -1) return;

    authUsers[index] = {
      ...authUsers[index],
      onboardingCompleted: true,
      selectedStationIds: this.selectedStationIds(),
    };

    localStorage.setItem(this.AUTH_USERS_KEY, JSON.stringify(authUsers));

    const updatedCurrentUser: CurrentUser = {
      id: authUsers[index].id,
      email: authUsers[index].email,
      name: authUsers[index].name,
      role: authUsers[index].role,
      status: authUsers[index].status,
      avatarUrl: authUsers[index].avatarUrl,
      onboardingCompleted: authUsers[index].onboardingCompleted,
      selectedStationIds: authUsers[index].selectedStationIds,
    };

    this.authState.setCurrentUser(updatedCurrentUser);
  }

  // =========================
  // ESCUCHAR AHORA
  // Selecciona una estación random de las elegidas
  // =========================
  listenNow(): void {
    const selected = this.selectedStations();

    if (selected.length === 0) {
      console.warn('No hay estaciones seleccionadas');
      window.location.href = '/user/home';
      return;
    }

    const randomIndex = Math.floor(Math.random() * selected.length);
    const randomStation = selected[randomIndex];

    console.log('Estación random elegida:', randomStation);

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
  private loadAuthUsers(): AuthUser[] {
    try {
      const raw = localStorage.getItem(this.AUTH_USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}