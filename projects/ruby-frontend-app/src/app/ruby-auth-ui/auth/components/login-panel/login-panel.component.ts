import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-login-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login-panel.component.html',
  styleUrl: './login-panel.component.scss',
})
export class LoginPanelComponent {
  private readonly fb = inject(FormBuilder);

  @Input() isBlockedAccountModalOpen = false;
  @Input() blockedAccountReason = '';
  @Input() blockedAccountSupportEmail = 'soporte@rubytune.com';

  @Output() back = new EventEmitter<void>();
  @Output() success = new EventEmitter<{ email: string; password: string }>();
  @Output() forgotPassword = new EventEmitter<void>();
  @Output() blockedAccountModalClose = new EventEmitter<void>();

  readonly isSubmitting = signal(false);
  readonly showPassword = signal(false);
  readonly generalError = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  onBackClick(): void {
    this.back.emit();
  }

  onForgotPasswordClick(): void {
    this.forgotPassword.emit();
  }

  onBlockedAccountModalClose(): void {
    this.blockedAccountModalClose.emit();
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(value => !value);
  }

  submit(): void {
    this.generalError.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const payload = {
      email: this.emailControl.value.trim().toLowerCase(),
      password: this.passwordControl.value,
    };

    this.success.emit(payload);
    this.isSubmitting.set(false);
  }

  get emailControl() {
    return this.form.controls.email;
  }

  get passwordControl() {
    return this.form.controls.password;
  }

  get emailError(): string {
    if (!this.emailControl.touched && !this.emailControl.dirty) return '';

    if (this.emailControl.hasError('required')) {
      return 'El correo es obligatorio';
    }

    if (this.emailControl.hasError('email')) {
      return 'Ingresa un correo válido';
    }

    return '';
  }

  get passwordError(): string {
    if (!this.passwordControl.touched && !this.passwordControl.dirty) return '';

    if (this.passwordControl.hasError('required')) {
      return 'La contraseña es obligatoria';
    }

    if (this.passwordControl.hasError('minlength')) {
      return 'La contraseña debe tener al menos 8 caracteres';
    }

    return '';
  }
}