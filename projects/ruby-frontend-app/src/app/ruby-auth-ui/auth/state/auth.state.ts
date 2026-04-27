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
  selectedArtistIds: string[];
  selectedStationIds?: string[];
}

interface OnboardingRecord {
  completed: boolean;
  artistIds: string[];
  stationIds?: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthState {
  // ── Storage keys ────────────────────────────────────────────────────────────
  private readonly SELECTED_ARTISTS_KEY = 'ruby_selected_artists';
  private readonly LEGACY_SELECTED_STATIONS_KEY = 'ruby_selected_stations';
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

  // ── Onboarding artist preferences ───────────────────────────────────────────
  private readonly _selectedArtists = signal<string[]>(this.loadSelectedArtists());
  readonly selectedArtists = this._selectedArtists.asReadonly();

  // Legacy aliases (backward compatibility with existing call sites)
  readonly selectedStations = this.selectedArtists;

  // ── Methods ─────────────────────────────────────────────────────────────────

  setArtists(artistIds: string[]): void {
    this._selectedArtists.set(artistIds);
    localStorage.setItem(this.SELECTED_ARTISTS_KEY, JSON.stringify(artistIds));
  }

  setStations(stationIds: string[]): void {
    this.setArtists(stationIds);
  }

  clearArtists(): void {
    this._selectedArtists.set([]);
    localStorage.removeItem(this.SELECTED_ARTISTS_KEY);
    localStorage.removeItem(this.LEGACY_SELECTED_STATIONS_KEY);
  }

  clearStations(): void {
    this.clearArtists();
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
    this.clearArtists();
    this.clearPendingEmail();
    this.resetDraft();
  }

  // ── Onboarding persistence per userId (survives logout) ─────────────────────

  markOnboardingCompleted(userId: string, artistIds: string[]): void {
    if (!userId) return;
    const map = this.loadOnboardingMap();
    map[userId] = { completed: true, artistIds: [...artistIds] };
    localStorage.setItem(this.ONBOARDING_MAP_KEY, JSON.stringify(map));
  }

  hasCompletedOnboarding(userId: string): boolean {
    if (!userId) return false;
    return this.loadOnboardingMap()[userId]?.completed === true;
  }

  getOnboardingArtistIds(userId: string): string[] {
    if (!userId) return [];
    const record = this.loadOnboardingMap()[userId];
    if (!record) return [];
    return record.artistIds ?? record.stationIds ?? [];
  }

  getOnboardingStationIds(userId: string): string[] {
    return this.getOnboardingArtistIds(userId);
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
        selectedArtistIds: this.getOnboardingArtistIds(userId),
      };
    } catch {
      return null;
    }
  }

  // ── Loaders ─────────────────────────────────────────────────────────────────

  private loadSelectedArtists(): string[] {
    try {
      const raw = localStorage.getItem(this.SELECTED_ARTISTS_KEY)
        ?? localStorage.getItem(this.LEGACY_SELECTED_STATIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private loadCurrentUser(): CurrentUser | null {
    try {
      const raw = localStorage.getItem(this.CURRENT_USER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<CurrentUser> & { selectedStationIds?: string[] };
      return {
        id: parsed.id ?? '',
        email: parsed.email ?? '',
        name: parsed.name ?? '',
        role: parsed.role ?? 'USER',
        status: parsed.status ?? 'ACTIVE',
        avatarUrl: parsed.avatarUrl ?? null,
        onboardingCompleted: parsed.onboardingCompleted ?? false,
        selectedArtistIds: parsed.selectedArtistIds ?? parsed.selectedStationIds ?? [],
        selectedStationIds: parsed.selectedStationIds,
      };
    } catch {
      return null;
    }
  }
}
