import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { LoginUseCase, RegisterUseCase, Gender } from 'lib-ruby-core';

import { AuthShellBrandingComponent } from '../../components/auth-shell-branding/auth-shell-branding.component';
import { AuthEntryPanelComponent } from '../../components/auth-entry-panel/auth-entry-panel.component';
import { LoginPanelComponent } from '../../components/login-panel/login-panel.component';
import { RegisterEmailStepComponent } from '../../components/register-email-step/register-email-step.component';
import { AuthView } from '../../models/auth-view.type';
import { RegisterPasswordStepComponent } from '../../components/register-password-step/register-password-step.component';
import { RegisterBirthdateStepComponent } from '../../components/register-birthdate-step/register-birthdate-step.component';
import { RegisterGenderStepComponent } from '../../components/register-gender-step/register-gender-step.component';
import { RegisterNameStepComponent } from '../../components/register-name-step/register-name-step.component';
import { AuthState, CurrentUser } from '../../state/auth.state';
import { TokenStorageService } from '../../../../core/services/token-storage.service';

@Component({
  selector: 'app-welcome-page',
  standalone: true,
  imports: [
    CommonModule,
    AuthShellBrandingComponent,
    AuthEntryPanelComponent,
    LoginPanelComponent,
    RegisterEmailStepComponent,
    RegisterPasswordStepComponent,
    RegisterBirthdateStepComponent,
    RegisterGenderStepComponent,
    RegisterNameStepComponent,
  ],
  templateUrl: './welcome.page.html',
  styleUrl: './welcome.page.scss',
})
export class WelcomePage {
  private readonly authState = inject(AuthState);
  private readonly loginUseCase = inject(LoginUseCase);
  private readonly registerUseCase = inject(RegisterUseCase);
  private readonly tokenStorage = inject(TokenStorageService);

  view: AuthView = 'entry';

  // =========================
  // ESTADO UI
  // =========================
  readonly isLoading = signal(false);
  readonly isBlockedAccountModalOpen = signal(false);
  readonly blockedAccountReason = signal('');
  readonly blockedAccountSupportEmail = 'soporte@rubytune.com';

  // =========================
  // NAVEGACIÓN BÁSICA
  // =========================
  goToEntry(): void {
    this.view = 'entry';
  }

  goToLogin(): void {
    this.closeBlockedAccountModal();
    this.view = 'login';
  }

  goToRegister(): void {
    this.authState.resetDraft();
    this.closeBlockedAccountModal();
    this.view = 'register-email';
  }

  // =========================
  // LOGIN REAL (SDK)
  // =========================
  onLoginSuccess(payload: { email: string; password: string }): void {
    console.log('[WelcomePage] onLoginSuccess called with:', payload);
    this.closeBlockedAccountModal();
    this.isLoading.set(true);

    console.log('[WelcomePage] Calling loginUseCase.execute...');
    this.loginUseCase.execute(payload.email, payload.password).subscribe({
      next: (token) => {
        console.log('[WelcomePage] Login SUCCESS — token received:', token);
        this.tokenStorage.setTokens(token.accessToken, token.refreshToken);
        const user = this.decodeUserFromToken(token.accessToken);
        this.isLoading.set(false);

        if (!user) {
          console.error('No se pudo decodificar el usuario del token');
          return;
        }

        this.authState.setCurrentUser(user);
        this.authState.setPendingEmail(user.email);

        if (user.role === 'ADMIN') {
          window.location.href = '/admin/dashboard';
          return;
        }

        if (!user.onboardingCompleted) {
          window.location.href = '/onboarding/stations';
          return;
        }

        window.location.href = '/user/home';
      },
      error: (err: unknown) => {
        console.error('[WelcomePage] Login ERROR full:', err);
        console.error('[WelcomePage] Login ERROR message:', (err as Error)?.message);
        console.error('[WelcomePage] Login ERROR stack:', (err as Error)?.stack);
        const httpErr = err as { status?: number; error?: { message?: string; blockReason?: string } };
        const msg = (httpErr?.error?.message ?? '').toLowerCase();
        if (httpErr?.status === 403 || msg.includes('blocked') || msg.includes('bloqueado')) {
          this.blockedAccountReason.set(httpErr?.error?.blockReason ?? 'Sin motivo especificado');
          this.isBlockedAccountModalOpen.set(true);
        }
        this.isLoading.set(false);
      },
    });
  }

  closeBlockedAccountModal(): void {
    this.isBlockedAccountModalOpen.set(false);
    this.blockedAccountReason.set('');
  }

  // =========================
  // FLUJO REGISTER + DRAFT
  // =========================
  goToRegisterPassword(data?: { email?: string }): void {
    if (data?.email) {
      this.authState.patchDraft({ email: data.email });
    }
    this.view = 'register-password';
  }

  goToRegisterBirthdate(data: { password: string; confirmPassword: string }): void {
    this.authState.patchDraft({
      password: data.password,
      confirmPassword: data.confirmPassword,
    });
    this.view = 'register-birthdate';
  }

  goToRegisterGender(data?: { birthDate?: string }): void {
    if (data?.birthDate) {
      this.authState.patchDraft({ birthDate: data.birthDate });
    }
    this.view = 'register-gender';
  }

  goToRegisterName(data: { gender: string }): void {
    this.authState.patchDraft({ gender: data.gender });
    this.view = 'register-name';
  }

  // =========================
  // FINALIZAR REGISTRO (SDK)
  // =========================
  onRegisterComplete(data: {
    name: string;
    termsAccepted: boolean;
    privacyAccepted: boolean;
  }): void {
    this.authState.patchDraft({
      name: data.name,
      termsAccepted: data.termsAccepted,
      privacyAccepted: data.privacyAccepted,
    });

    const draft = this.authState.draft();
    this.isLoading.set(true);

    this.registerUseCase
      .execute({
        email: (draft.email ?? '').trim().toLowerCase(),
        password: draft.password ?? '',
        displayName: draft.name ?? '',
        birthDate: draft.birthDate ?? '',
        gender: this.mapGender(draft.gender ?? ''),
        acceptedTerms: data.termsAccepted,
        acceptedPrivacyPolicy: data.privacyAccepted,
      })
      .subscribe({
        next: (user) => {
          this.authState.setPendingEmail(user.email);
          this.isLoading.set(false);
          window.location.href = '/onboarding/stations';
        },
        error: (err: { error?: { message?: string } }) => {
          console.error('Error en registro:', err?.error?.message);
          this.isLoading.set(false);
        },
      });
  }

  // =========================
  // HELPERS PRIVADOS
  // =========================
  private decodeUserFromToken(token: string): CurrentUser | null {
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload)) as {
        sub?: string;
        email?: string;
        name?: string;
        role?: string;
        status?: string;
        onboardingCompleted?: boolean;
        selectedStationIds?: string[];
        profilePhotoUrl?: string;
      };

      return {
        id: decoded.sub ?? '',
        email: decoded.email ?? '',
        name: decoded.name ?? '',
        role: (decoded.role as 'ADMIN' | 'USER') ?? 'USER',
        status: (decoded.status as 'ACTIVE' | 'BLOCKED' | 'INACTIVE') ?? 'ACTIVE',
        avatarUrl: decoded.profilePhotoUrl ?? null,
        onboardingCompleted: decoded.onboardingCompleted ?? false,
        selectedStationIds: decoded.selectedStationIds ?? [],
      };
    } catch {
      return null;
    }
  }

  private mapGender(gender: string): Gender {
    const map: Record<string, Gender> = {
      MALE: 'MALE',
      FEMALE: 'FEMALE',
      NON_BINARY: 'NON_BINARY',
      OTHER: 'OTHER',
      PREFIERO_NO_DECIR: 'PREFER_NOT_TO_SAY',
      PREFER_NOT_TO_SAY: 'PREFER_NOT_TO_SAY',
    };
    return map[gender] ?? 'PREFER_NOT_TO_SAY';
  }
}
