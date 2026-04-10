import { computed, Injectable, signal } from '@angular/core';
import { RegisterDraft } from '../models/register-draft.model';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'BLOCKED' | 'INACTIVE';
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  selectedStationIds: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthState {
  // ── Storage keys ────────────────────────────────────────────────────────────
  private readonly SELECTED_STATIONS_KEY = 'ruby_selected_stations';
  private readonly CURRENT_USER_KEY = 'ruby_current_user';

  // ── Auth session ────────────────────────────────────────────────────────────
  private readonly _currentUser = signal<CurrentUser | null>(this.loadCurrentUser());
  readonly currentUser = this._currentUser.asReadonly();

  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  // ── Register wizard draft ───────────────────────────────────────────────────
  private readonly _draft = signal<Partial<RegisterDraft>>({});
  readonly draft = this._draft.asReadonly();

  // ── OTP context ─────────────────────────────────────────────────────────────
  private readonly _pendingEmail = signal<string>('');
  readonly pendingEmail = this._pendingEmail.asReadonly();

  // ── Onboarding stations ─────────────────────────────────────────────────────
  private readonly _selectedStations = signal<string[]>(this.loadSelectedStations());
  readonly selectedStations = this._selectedStations.asReadonly();

  // ── Methods ─────────────────────────────────────────────────────────────────

  setStations(stationIds: string[]): void {
    this._selectedStations.set(stationIds);
    localStorage.setItem(this.SELECTED_STATIONS_KEY, JSON.stringify(stationIds));
  }

  clearStations(): void {
    this._selectedStations.set([]);
    localStorage.removeItem(this.SELECTED_STATIONS_KEY);
  }

  setCurrentUser(user: CurrentUser): void {
    this._currentUser.set(user);
    localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(user));
  }

  clearCurrentUser(): void {
    this._currentUser.set(null);
    localStorage.removeItem(this.CURRENT_USER_KEY);
  }

  patchDraft(patch: Partial<RegisterDraft>): void {
    this._draft.update(prev => ({ ...prev, ...patch }));
  }

  resetDraft(): void {
    this._draft.set({});
  }

  setPendingEmail(email: string): void {
    this._pendingEmail.set(email);
  }

  clearPendingEmail(): void {
    this._pendingEmail.set('');
  }

  clearSession(): void {
    this.clearCurrentUser();
    this.clearStations();
    this.clearPendingEmail();
    this.resetDraft();
  }

  // ── Loaders ─────────────────────────────────────────────────────────────────

  private loadSelectedStations(): string[] {
    try {
      const raw = localStorage.getItem(this.SELECTED_STATIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private loadCurrentUser(): CurrentUser | null {
    try {
      const raw = localStorage.getItem(this.CURRENT_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}