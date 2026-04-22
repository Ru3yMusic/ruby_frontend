import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-register-email-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register-email-step.component.html',
  styleUrl: './register-email-step.component.scss',
})
export class RegisterEmailStepComponent {
  // Inyección de dependencias
  private readonly fb = inject(FormBuilder);

  // Eventos para navegar entre vistas del welcome
  @Output() back = new EventEmitter<void>();
  @Output() next = new EventEmitter<{ email: string }>();

  // Estado visual del componente
  readonly isSubmitting = signal(false);
  readonly generalError = signal('');

  // Formulario del paso correo
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  // Acción para volver a la vista anterior
  onBackClick(): void {
    this.back.emit();
  }

  // Google OAuth aún no está implementado en backend. El botón permanece
  // visible como placeholder pero queda disabled hasta integrar el flujo.
  readonly isGoogleDisabled = true;

  // Acción principal del paso
  submit(): void {
    this.generalError.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const payload = {
      email: this.emailControl.value.trim().toLowerCase(),
    };

    // Más adelante aquí irá:
    // 1. Validar si el correo ya existe en ruby_auth_users
    // 2. Si no existe, avanzar al siguiente paso
    // 3. Si existe, mostrar mensaje de error

    this.next.emit(payload);
    this.isSubmitting.set(false);
  }

  // Helpers de acceso al formulario
  get emailControl() {
    return this.form.controls.email;
  }

  // Mensaje de error del correo
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
}