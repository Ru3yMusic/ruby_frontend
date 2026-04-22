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

interface OnboardingRecord {
  completed: boolean;
  stationIds: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthState {
  // ── Storage keys ────────────────────────────────────────────────────────────
  private readonly SELECTED_STATIONS_KEY = 'ruby_selected_stations';
  private readonly CURRENT_USER_KEY = 'ruby_current_user';
  private readonly ONBOARDING_MAP_KEY = 'ruby_onboarding_map';

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

  // ── Onboarding persistence per userId (survives logout) ─────────────────────

  markOnboardingCompleted(userId: string, stationIds: string[]): void {
    if (!userId) return;
    const map = this.loadOnboardingMap();
    map[userId] = { completed: true, stationIds: [...stationIds] };
    localStorage.setItem(this.ONBOARDING_MAP_KEY, JSON.stringify(map));
  }

  hasCompletedOnboarding(userId: string): boolean {
    if (!userId) return false;
    return this.loadOnboardingMap()[userId]?.completed === true;
  }

  getOnboardingStationIds(userId: string): string[] {
    if (!userId) return [];
    return this.loadOnboardingMap()[userId]?.stationIds ?? [];
  }

  private loadOnboardingMap(): Record<string, OnboardingRecord> {
    try {
      const raw = localStorage.getItem(this.ONBOARDING_MAP_KEY);
      return raw ? (JSON.parse(raw) as Record<string, OnboardingRecord>) : {};
    } catch {
      return {};
    }
  }

  // ── JWT decoding (shared helper for welcome + verify-email) ─────────────────

  decodeUserFromToken(token: string): CurrentUser | null {
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload)) as {
        sub?: string;
        email?: string;
        displayName?: string;
        name?: string;
        role?: string;
        status?: string;
        profilePhotoUrl?: string;
      };

      const resolvedName = decoded.displayName ?? decoded.name ?? '';
      const resolvedAvatar =
        decoded.profilePhotoUrl && decoded.profilePhotoUrl.length > 0
          ? decoded.profilePhotoUrl
          : null;

      const userId = decoded.sub ?? '';
      const completed = this.hasCompletedOnboarding(userId);

      return {
        id: userId,
        email: decoded.email ?? '',
        name: resolvedName,
        role: (decoded.role as 'ADMIN' | 'USER') ?? 'USER',
        status: (decoded.status as 'ACTIVE' | 'BLOCKED' | 'INACTIVE') ?? 'ACTIVE',
        avatarUrl: resolvedAvatar,
        onboardingCompleted: completed,
        selectedStationIds: this.getOnboardingStationIds(userId),
      };
    } catch {
      return null;
    }
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