import { Component, inject, signal, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { LoginUseCase, VerifyOtpUseCase } from 'lib-ruby-core';
import { AuthTemplateComponent, OtpVerifyFormComponent } from 'lib-ruby-core-ui';
import { AuthState } from '../../state/auth.state';
import { TokenStorageService } from '../../../../core/services/token-storage.service';

@Component({
  selector: 'rm-verify-email',
  standalone: true,
  imports: [AuthTemplateComponent, OtpVerifyFormComponent],
  template: `
    <rm-auth-template theme="red" [showBack]="true" [showLogo]="true">
      <rm-otp-verify-form
        #form
        [email]="email()"
        [loading]="loading()"
        [serverError]="serverError()"
        (codeEntered)="onVerify($event)"
        (resendClicked)="onResend()"/>
    </rm-auth-template>
  `,
})
export class VerifyEmailPage {
  @ViewChild('form') form!: OtpVerifyFormComponent;

  private readonly verifyUC     = inject(VerifyOtpUseCase);
  private readonly loginUC      = inject(LoginUseCase);
  private readonly authState    = inject(AuthState);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router       = inject(Router);

  email       = this.authState.pendingEmail;
  loading     = signal(false);
  serverError = signal('');

  onVerify(code: string): void {
    this.loading.set(true);
    this.verifyUC.execute(this.email(), code, 'REGISTER').subscribe({
      next: () => this.autoLoginAfterVerify(),
      error: () => {
        this.serverError.set('Código incorrecto o expirado.');
        this.loading.set(false);
        this.form.reset();
      },
    });
  }

  private autoLoginAfterVerify(): void {
    const password = this.authState.draft().password;
    if (!password) {
      // Sin password en memoria (refresh o vuelve después) → el usuario debe loguearse manualmente.
      this.loading.set(false);
      this.router.navigateByUrl('/auth/welcome');
      return;
    }

    this.loginUC.execute(this.email(), password).subscribe({
      next: (token) => {
        this.tokenStorage.setTokens(token.accessToken, token.refreshToken);
        const user = this.authState.decodeUserFromToken(token.accessToken);
        if (user) {
          this.authState.setCurrentUser(user);
        }
        this.authState.resetDraft();
        this.loading.set(false);
        this.router.navigateByUrl('/onboarding/stations');
      },
      error: () => {
        // Email verificado pero login falló — enviar a login manual.
        this.authState.resetDraft();
        this.loading.set(false);
        this.router.navigateByUrl('/auth/welcome');
      },
    });
  }

  onResend(): void {
    this.verifyUC.resend(this.email(), 'REGISTER').subscribe();
  }
}
