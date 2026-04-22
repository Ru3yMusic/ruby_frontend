import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LoginUseCase, RegisterUseCase, Gender } from 'lib-ruby-core';
import { UsersApi } from 'lib-ruby-sdks/auth-service';

import { AuthShellBrandingComponent } from '../../components/auth-shell-branding/auth-shell-branding.component';
import { AuthEntryPanelComponent } from '../../components/auth-entry-panel/auth-entry-panel.component';
import { LoginPanelComponent } from '../../components/login-panel/login-panel.component';
import { RegisterEmailStepComponent } from '../../components/register-email-step/register-email-step.component';
import { AuthView } from '../../models/auth-view.type';
import { RegisterPasswordStepComponent } from '../../components/register-password-step/register-password-step.component';
import { RegisterBirthdateStepComponent } from '../../components/register-birthdate-step/register-birthdate-step.component';
import { RegisterGenderStepComponent } from '../../components/register-gender-step/register-gender-step.component';
import { RegisterNameStepComponent } from '../../components/register-name-step/register-name-step.component';
import { AuthState } from '../../state/auth.state';
import { TokenStorageService } from '../../../../core/services/token-storage.service';
import { translateBlockReason } from '../../../../core/utils/block-reason-label';

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
  private readonly router = inject(Router);
  private readonly usersApi = inject(UsersApi);

  view: AuthView = 'entry';

  // =========================
  // ESTADO UI
  // =========================
  readonly isLoading = signal(false);
  readonly isBlockedAccountModalOpen = signal(false);
  readonly blockedAccountReason = signal('');
  readonly blockedAccountSupportEmail = 'soporte@rubytune.com';

  // Block-reason translation lives in core/utils/block-reason-label.ts and is
  // shared with gestión de usuarios so the Spanish labels stay in one place.

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
        const user = this.authState.decodeUserFromToken(token.accessToken);
        this.isLoading.set(false);

        if (!user) {
          console.error('No se pudo decodificar el usuario del token');
          return;
        }

        this.authState.setCurrentUser(user);
        this.authState.setPendingEmail(user.email);

        // Hidratar avatarUrl desde backend: el JWT ya no trae profilePhotoUrl
        // (fix del 431), así que lo leemos de /users/{id} tras el login.
        this.usersApi.getUserById(user.id).subscribe({
          next: (dto) => {
            const avatar = dto?.profilePhotoUrl ?? null;
            if (avatar) {
              this.authState.setCurrentUser({ ...user, avatarUrl: avatar });
            }
          },
          error: () => { /* deja currentUser como está si falla */ },
        });

        if (user.role === 'ADMIN') {
          this.router.navigateByUrl('/admin/dashboard');
          return;
        }

        if (!user.onboardingCompleted) {
          this.router.navigateByUrl('/onboarding/stations');
          return;
        }

        this.router.navigateByUrl('/user/home');
      },
      error: (err: unknown) => {
        console.error('[WelcomePage] Login ERROR full:', err);
        console.error('[WelcomePage] Login ERROR message:', (err as Error)?.message);
        console.error('[WelcomePage] Login ERROR stack:', (err as Error)?.stack);
        const httpErr = err as { status?: number; error?: { message?: string; blockReason?: string } };
        const msg = (httpErr?.error?.message ?? '').toLowerCase();
        if (httpErr?.status === 403 || msg.includes('blocked') || msg.includes('bloqueado')) {
          this.blockedAccountReason.set(translateBlockReason(httpErr?.error?.blockReason));
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
    const email = (draft.email ?? '').trim().toLowerCase();
    const password = draft.password ?? '';
    this.isLoading.set(true);

    this.registerUseCase
      .execute({
        email,
        password,
        displayName: draft.name ?? '',
        birthDate: draft.birthDate ?? '',
        gender: this.mapGender(draft.gender ?? ''),
        acceptedTerms: data.termsAccepted,
        acceptedPrivacyPolicy: data.privacyAccepted,
      })
      .subscribe({
        next: (user) => {
          this.authState.setPendingEmail(user.email);
          this.autoLoginAfterRegister(email, password);
        },
        error: (err: { error?: { message?: string } }) => {
          console.error('Error en registro:', err?.error?.message);
          this.isLoading.set(false);
        },
      });
  }

  private autoLoginAfterRegister(email: string, password: string): void {
    if (!email || !password) {
      this.isLoading.set(false);
      this.router.navigateByUrl('/auth/welcome');
      return;
    }

    this.loginUseCase.execute(email, password).subscribe({
      next: (token) => {
        this.tokenStorage.setTokens(token.accessToken, token.refreshToken);
        const user = this.authState.decodeUserFromToken(token.accessToken);
        if (user) {
          this.authState.setCurrentUser(user);
        }
        this.authState.resetDraft();
        this.isLoading.set(false);
        this.router.navigateByUrl('/onboarding/stations');
      },
      error: (err: unknown) => {
        console.error('Error en auto-login post-register:', err);
        this.isLoading.set(false);
        this.router.navigateByUrl('/auth/welcome');
      },
    });
  }

  // =========================
  // HELPERS PRIVADOS
  // =========================
  private mapGender(gender: string): Gender {
    // Picker emite: FEMENINO, MASCULINO, NO_BINARIO, OTRO, PREFIERO_NO_DECIR.
    // Backend acepta: FEMENINO, MASCULINO, NO_BINARIO, OTRO, PREFER_NOT_SAY.
    const map: Record<string, string> = {
      FEMENINO: 'FEMENINO',
      MASCULINO: 'MASCULINO',
      NO_BINARIO: 'NO_BINARIO',
      OTRO: 'OTRO',
      PREFIERO_NO_DECIR: 'PREFER_NOT_SAY',
    };
    return (map[gender] ?? 'PREFER_NOT_SAY') as unknown as Gender;
  }
}
