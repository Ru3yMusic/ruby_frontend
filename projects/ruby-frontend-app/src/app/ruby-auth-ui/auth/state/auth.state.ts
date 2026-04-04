import { computed, Injectable, signal } from '@angular/core';
import { AuthToken, Gender, RegisterPayload } from 'lib-ruby-core';

export interface RegisterDraft {
  email: string;
  password: string;
  displayName: string;
  birthDate: string;
  gender: Gender | null;
  acceptedTerms: boolean;
  acceptedPrivacyPolicy: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthState {
  // ── Auth session ────────────────────────────────────────────────────────────
  private readonly _token = signal<AuthToken | null>(this.loadToken());
  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => this._token() !== null);

  // ── Register wizard draft ───────────────────────────────────────────────────
  private readonly _draft = signal<Partial<RegisterDraft>>({});
  readonly draft = this._draft.asReadonly();

  // ── OTP context ─────────────────────────────────────────────────────────────
  private readonly _pendingEmail = signal<string>('');
  readonly pendingEmail = this._pendingEmail.asReadonly();

  // ── Methods ─────────────────────────────────────────────────────────────────

  setToken(token: AuthToken): void {
    this._token.set(token);
    localStorage.setItem('auth_token', JSON.stringify(token));
  }

  clearToken(): void {
    this._token.set(null);
    localStorage.removeItem('auth_token');
  }

  patchDraft(patch: Partial<RegisterDraft>): void {
    this._draft.update(prev => ({ ...prev, ...patch }));
  }

  resetDraft(): void {
    this._draft.set({});
  }

  getDraftAsPayload(): RegisterPayload {
    const d = this._draft();
    return {
      email:                 d.email ?? '',
      password:              d.password ?? '',
      displayName:           d.displayName ?? '',
      birthDate:             d.birthDate ?? '',
      gender:                d.gender ?? 'OTHER',
      acceptedTerms:         d.acceptedTerms ?? false,
      acceptedPrivacyPolicy: d.acceptedPrivacyPolicy ?? false,
    };
  }

  setPendingEmail(email: string): void {
    this._pendingEmail.set(email);
  }

  private loadToken(): AuthToken | null {
    try {
      const raw = localStorage.getItem('auth_token');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
