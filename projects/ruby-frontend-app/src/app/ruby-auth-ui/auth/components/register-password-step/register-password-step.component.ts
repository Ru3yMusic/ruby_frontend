import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';

@Component({
  selector: 'app-register-password-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register-password-step.component.html',
  styleUrl: './register-password-step.component.scss',
})
export class RegisterPasswordStepComponent {
  // Inyección de dependencias
  private readonly fb = inject(FormBuilder);

  // Eventos para navegar entre pasos del registro
  @Output() back = new EventEmitter<void>();
  @Output() next = new EventEmitter<{ password: string; confirmPassword: string }>();

  // Estado visual del componente
  readonly isSubmitting = signal(false);
  readonly generalError = signal('');
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly showValidationErrors = signal(false);

  // Formulario del paso contraseña
  readonly form = this.fb.group(
    {
      password: ['', [Validators.required, Validators.minLength(8), this.passwordStrengthValidator]],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: [this.passwordsMatchValidator],
    }
  );

  // Acción para volver al paso anterior
  onBackClick(): void {
    this.back.emit();
  }

  // Mostrar u ocultar contraseña principal
  togglePasswordVisibility(): void {
    this.showPassword.update(value => !value);
  }

  // Mostrar u ocultar confirmación de contraseña
  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update(value => !value);
  }

  // Acción principal del paso
  submit(): void {
    this.generalError.set('');
    this.showValidationErrors.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const payload = {
      password: (this.passwordControl.value ?? '').trim(),
      confirmPassword: (this.confirmPasswordControl.value ?? '').trim(),
    };

    this.next.emit(payload);
    this.isSubmitting.set(false);
  }

  // Validator: fuerza mínima de contraseña
  private passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value ?? '');

    if (!value) return null;

    const hasUppercase = /[A-Z]/.test(value);
    const hasNumber = /\d/.test(value);

    if (!hasUppercase || !hasNumber) {
      return { weakPassword: true };
    }

    return null;
  }

  // Validator: ambas contraseñas deben coincidir
  private passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value ?? '';
    const confirmPassword = group.get('confirmPassword')?.value ?? '';

    if (!password || !confirmPassword) return null;

    if (password !== confirmPassword) {
      return { passwordMismatch: true };
    }

    return null;
  }

  // Helpers de acceso al formulario
  get passwordControl() {
    return this.form.controls.password;
  }

  get confirmPasswordControl() {
    return this.form.controls.confirmPassword;
  }

  // Mensajes de error del campo contraseña
  get passwordError(): string {
    if (!this.showValidationErrors()) return '';

    if (this.passwordControl.hasError('required')) {
      return 'La contraseña es obligatoria';
    }

    if (this.passwordControl.hasError('minlength')) {
      return 'La contraseña debe tener al menos 8 caracteres';
    }

    if (this.passwordControl.hasError('weakPassword')) {
      return 'Debe tener al menos una mayúscula y un número';
    }

    return '';
  }

  // Mensajes de error del campo confirmar contraseña
  get confirmPasswordError(): string {
    if (!this.showValidationErrors()) return '';

    if (this.confirmPasswordControl.hasError('required')) {
      return 'Debes confirmar la contraseña';
    }

    if (this.form.hasError('passwordMismatch')) {
      return 'Las contraseñas no coinciden';
    }

    return '';
  }
}