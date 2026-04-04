import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthTemplateComponent, ButtonComponent, InputFieldComponent } from 'lib-ruby-core-ui';
import { AuthState } from '../../state/auth.state';

@Component({
  selector: 'rm-register-password',
  standalone: true,
  imports: [ReactiveFormsModule, AuthTemplateComponent, InputFieldComponent, ButtonComponent],
  templateUrl: './register-password.page.html',
  styleUrl: './register-password.page.scss',
})
export class RegisterPasswordPage {
  private readonly fb        = inject(FormBuilder);
  private readonly authState = inject(AuthState);
  private readonly router    = inject(Router);

  form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.authState.patchDraft({ password: this.form.value.password! });
    this.router.navigate(['/auth/register/birthdate']);
  }
}
