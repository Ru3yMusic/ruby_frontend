import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputFieldComponent } from '../../atoms/input-field/input-field.component';
import { ButtonComponent } from '../../atoms/button/button.component';

export interface LoginFormValue {
  email:    string;
  password: string;
}

@Component({
  selector: 'rm-login-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, InputFieldComponent, ButtonComponent],
  templateUrl: './login-form.component.html',
  styleUrl: './login-form.component.scss',
})
export class LoginFormComponent {
  private readonly fb = inject(FormBuilder);

  // ── Inputs from page ──────────────────────────────────────────────────
  loading     = input(false);
  serverError = input('');

  // ── Events to page ────────────────────────────────────────────────────
  submitted = output<LoginFormValue>();

  // ── Form ──────────────────────────────────────────────────────────────
  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitted.emit(this.form.value as LoginFormValue);
  }

  get emailError(): string {
    const ctrl = this.form.get('email');
    if (!ctrl?.touched) return '';
    if (ctrl.hasError('required')) return 'El correo es requerido.';
    if (ctrl.hasError('email'))    return 'Ingresá un correo válido.';
    return '';
  }

  get passwordError(): string {
    const ctrl = this.form.get('password');
    if (!ctrl?.touched) return '';
    if (ctrl.hasError('required'))   return 'La contraseña es requerida.';
    if (ctrl.hasError('minlength'))  return 'Mínimo 6 caracteres.';
    return '';
  }
}
