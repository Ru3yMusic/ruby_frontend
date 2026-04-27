import { Injectable, effect, inject } from '@angular/core';
import { AuthRepositoryPort } from 'lib-ruby-core';
import { timeout } from 'rxjs/operators';
import { TokenStorageService } from './token-storage.service';

const REFRESH_SKEW_MS = 60_000;
const RETRY_DELAY_MS = 15_000;
const MIN_SCHEDULE_MS = 5_000;
const REFRESH_TIMEOUT_MS = 10_000;

@Injectable({ providedIn: 'root' })
export class SessionKeepaliveService {
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly authRepo = inject(AuthRepositoryPort);

  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private isRefreshing = false;

  private readonly onVisibilityChange = (): void => {
    if (typeof document === 'undefined' || document.hidden) return;
    this.maybeRefreshSoon();
  };

  private readonly onWsAuthExpired = (): void => {
    this.refreshSilently();
  };

  constructor() {
    effect(() => {
      const accessToken = this.tokenStorage.accessToken();
      this.clearTimer();

      if (!accessToken) return;

      const expiresAt = this.tokenStorage.getTokenExpiryMs(accessToken);
      if (!expiresAt) return;

      const delay = Math.max(MIN_SCHEDULE_MS, expiresAt - Date.now() - REFRESH_SKEW_MS);
      this.refreshTimer = setTimeout(() => this.refreshSilently(), delay);
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('ruby-ws-auth-expired', this.onWsAuthExpired);
    }
  }

  private refreshSilently(): void {
    if (this.isRefreshing) return;

    const refreshToken = this.tokenStorage.getRefreshToken();
    if (!refreshToken) return;

    this.isRefreshing = true;

    this.authRepo
      .refreshToken(refreshToken)
      .pipe(timeout(REFRESH_TIMEOUT_MS))
      .subscribe({
        next: tokenPair => {
          this.isRefreshing = false;
          this.tokenStorage.setTokens(tokenPair.accessToken, tokenPair.refreshToken);
        },
        error: () => {
          this.isRefreshing = false;
          this.refreshTimer = setTimeout(() => this.refreshSilently(), RETRY_DELAY_MS);
        },
      });
  }

  private clearTimer(): void {
    if (this.refreshTimer === null) return;
    clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }

  private maybeRefreshSoon(): void {
    const accessToken = this.tokenStorage.getAccessToken();
    if (!accessToken) return;

    const expiresAt = this.tokenStorage.getTokenExpiryMs(accessToken);
    if (!expiresAt || expiresAt - Date.now() <= REFRESH_SKEW_MS) {
      this.refreshSilently();
    }
  }
}
