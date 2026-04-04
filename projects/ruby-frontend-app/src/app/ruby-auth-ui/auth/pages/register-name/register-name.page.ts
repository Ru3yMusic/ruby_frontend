import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { RegisterUseCase } from 'lib-ruby-core';
import { AuthTemplateComponent, ButtonComponent, InputFieldComponent } from 'lib-ruby-core-ui';
import { AuthState } from '../../state/auth.state';

@Component({
  selector: 'rm-register-name',
  standalone: true,
  imports: [ReactiveFormsModule, AuthTemplateComponent, InputFieldComponent, ButtonComponent],
  templateUrl: './register-name.page.html',
  styleUrl: './register-name.page.scss',
})
export class RegisterNamePage {
  private readonly fb         = inject(FormBuilder);
  private readonly registerUC = inject(RegisterUseCase);
  private readonly authState  = inject(AuthState);
  private readonly router     = inject(Router);

  loading     = signal(false);
  serverError = signal('');

  form = this.fb.group({
    displayName:           ['', [Validators.required, Validators.minLength(2)]],
    acceptedTerms:         [false, Validators.requiredTrue],
    acceptedPrivacyPolicy: [false, Validators.requiredTrue],
  });

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.authState.patchDraft({
      displayName:           this.form.value.displayName!,
      acceptedTerms:         this.form.value.acceptedTerms!,
      acceptedPrivacyPolicy: this.form.value.acceptedPrivacyPolicy!,
    });

    const payload = this.authState.getDraftAsPayload();
    this.loading.set(true);

    this.registerUC.execute(payload).subscribe({
      next: () => {
        this.authState.setPendingEmail(payload.email);
        this.router.navigate(['/auth/verify-email']);
      },
      error: err => {
        this.serverError.set(err?.error?.message ?? 'Error al crear la cuenta.');
        this.loading.set(false);
      },
    });
  }
}
