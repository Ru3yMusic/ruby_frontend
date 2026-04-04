import { Component, inject, signal, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { VerifyOtpUseCase } from 'lib-ruby-core';
import { AuthTemplateComponent, OtpVerifyFormComponent } from 'lib-ruby-core-ui';
import { AuthState } from '../../state/auth.state';

@Component({
  selector: 'rm-forgot-password-otp',
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
export class ForgotPasswordOtpPage {
  @ViewChild('form') form!: OtpVerifyFormComponent;

  private readonly verifyUC  = inject(VerifyOtpUseCase);
  private readonly authState = inject(AuthState);
  private readonly router    = inject(Router);

  email       = this.authState.pendingEmail;
  loading     = signal(false);
  serverError = signal('');

  onVerify(code: string): void {
    this.loading.set(true);
    this.verifyUC.execute(this.email(), code, 'PASSWORD_RESET').subscribe({
      next: () => this.router.navigate(['/auth/reset-password']),
      error: () => {
        this.serverError.set('Código incorrecto o expirado.');
        this.loading.set(false);
        this.form.reset();
      },
    });
  }

  onResend(): void {
    this.verifyUC.resend(this.email(), 'PASSWORD_RESET').subscribe();
  }
}
