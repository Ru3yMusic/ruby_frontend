import { Injectable, signal } from '@angular/core';

export interface UserProfile {
  displayName: string;
  photoUrl: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserProfileState {
  readonly profile = signal<UserProfile>({
    displayName: 'Yoel',
    photoUrl: null,
  });

  updateProfile(updates: Partial<UserProfile>): void {
    this.profile.update(p => ({ ...p, ...updates }));
  }
}
