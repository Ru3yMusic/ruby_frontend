import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  UsersApi,
  UserResponse,
  UserStatsResponse,
  UpdateProfileRequest,
} from 'lib-ruby-sdks/auth-service';

@Injectable({ providedIn: 'root' })
export class UserProfileState {
  private readonly usersApi = inject(UsersApi);

  /* ===================== */
  /* SIGNALS */
  /* ===================== */

  private readonly _profile = signal<UserResponse | null>(null);
  readonly profile = this._profile.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  private readonly _stats = signal<UserStatsResponse | null>(null);
  readonly stats = this._stats.asReadonly();

  /* ===================== */
  /* METHODS */
  /* ===================== */

  loadProfile(userId: string): void {
    this._loading.set(true);
    this._error.set(null);
    this.usersApi.getUserById(userId).subscribe({
      next: (user) => {
        this._profile.set(user);
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading profile');
        this._loading.set(false);
      },
    });
  }

  /**
   * Calls UsersApi.updateProfile, updates the profile signal,
   * and returns the Observable so callers can chain on success
   * (e.g. to sync AuthState after the API confirms the save).
   */
  updateProfile(userId: string, data: UpdateProfileRequest): Observable<UserResponse> {
    this._loading.set(true);
    this._error.set(null);
    return this.usersApi.updateProfile(userId, data).pipe(
      tap({
        next: (user) => {
          this._profile.set(user);
          this._loading.set(false);
        },
        error: (err: { message?: string }) => {
          this._error.set(err?.message ?? 'Error updating profile');
          this._loading.set(false);
        },
      })
    );
  }

  getUserStats(): void {
    this._loading.set(true);
    this._error.set(null);
    this.usersApi.getUserStats().subscribe({
      next: (stats) => {
        this._stats.set(stats);
        this._loading.set(false);
      },
      error: (err: { message?: string }) => {
        this._error.set(err?.message ?? 'Error loading user stats');
        this._loading.set(false);
      },
    });
  }

  /* ===================== */
  /* UTILS */
  /* ===================== */

  clearError(): void {
    this._error.set(null);
  }
}
