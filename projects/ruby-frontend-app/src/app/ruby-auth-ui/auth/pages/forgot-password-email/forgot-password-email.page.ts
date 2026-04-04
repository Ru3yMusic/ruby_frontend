import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { RequestPasswordResetUseCase } from 'lib-ruby-core';
import { AuthTemplateComponent, ButtonComponent, InputFieldComponent } from 'lib-ruby-core-ui';
import { AuthState } from '../../state/auth.state';

@Component({
  selector: 'rm-forgot-password-email',
  standalone: true,
  imports: [ReactiveFormsModule, AuthTemplateComponent, InputFieldComponent, ButtonComponent],
  templateUrl: './forgot-password-email.page.html',
  styleUrl: './forgot-password-email.page.scss',
})
export class ForgotPasswordEmailPage {
  private fb        = inject(FormBuilder);
  private resetUC   = inject(RequestPasswordResetUseCase);
  private authState = inject(AuthState);
  private router    = inject(Router);

  loading     = signal(false);
  serverError = signal('');

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  onSubmit(): void {
    if (this.form.invalid) return;
    const email = this.form.value.email!;
    this.loading.set(true);

    this.resetUC.execute(email).subscribe({
      next: () => {
        this.authState.setPendingEmail(email);
        this.router.navigate(['/auth/forgot-password/otp']);
      },
      error: () => {
        this.serverError.set('Ocurrió un error. Intentá nuevamente.');
        this.loading.set(false);
      },
    });
  }
}
