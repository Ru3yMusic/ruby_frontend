import { Injectable, signal } from '@angular/core';

const ACCESS_TOKEN_KEY = 'ruby_access_token';
const REFRESH_TOKEN_KEY = 'ruby_refresh_token';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly _accessToken = signal<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY));
  private readonly _refreshToken = signal<string | null>(localStorage.getItem(REFRESH_TOKEN_KEY));

  readonly accessToken = this._accessToken.asReadonly();
  readonly refreshToken = this._refreshToken.asReadonly();

  setTokens(accessToken: string, refreshToken: string): void {
    this._accessToken.set(accessToken);
    this._refreshToken.set(refreshToken);
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  clearTokens(): void {
    this._accessToken.set(null);
    this._refreshToken.set(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  getAccessToken(): string | null {
    return this._accessToken();
  }

  getRefreshToken(): string | null {
    return this._refreshToken();
  }

  getTokenExpiryMs(token: string): number | null {
    const payload = this.decodeTokenPayload(token);
    if (!payload?.exp) return null;
    return payload.exp * 1000;
  }

  isTokenExpired(token: string): boolean {
    const expMs = this.getTokenExpiryMs(token);
    return expMs === null || expMs < Date.now();
  }

  private decodeTokenPayload(token: string): { exp?: number } | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;

      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      return JSON.parse(atob(padded)) as { exp?: number };
    } catch {
      return null;
    }
  }
}
