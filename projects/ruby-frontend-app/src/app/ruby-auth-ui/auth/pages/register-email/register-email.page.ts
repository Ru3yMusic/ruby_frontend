import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthTemplateComponent, ButtonComponent, InputFieldComponent } from 'lib-ruby-core-ui';
import { AuthState } from '../../state/auth.state';

@Component({
  selector: 'rm-register-email',
  standalone: true,
  imports: [ReactiveFormsModule, AuthTemplateComponent, InputFieldComponent, ButtonComponent],
  templateUrl: './register-email.page.html',
  styleUrl: './register-email.page.scss',
})
export class RegisterEmailPage {
  private readonly fb        = inject(FormBuilder);
  private readonly authState = inject(AuthState);
  private readonly router    = inject(Router);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.authState.patchDraft({ email: this.form.value.email! });
    this.router.navigate(['/auth/register/password']);
  }
}
