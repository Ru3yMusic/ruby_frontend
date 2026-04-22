import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-register-name-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register-name-step.component.html',
  styleUrl: './register-name-step.component.scss',
})
export class RegisterNameStepComponent {
  // Inyección de dependencias
  private readonly fb = inject(FormBuilder);

  // Eventos para navegar entre pasos
  @Output() back = new EventEmitter<void>();
  @Output() complete = new EventEmitter<{
    name: string;
    termsAccepted: boolean;
    privacyAccepted: boolean;
  }>();

  // Estado visual
  readonly isSubmitting = signal(false);
  readonly generalError = signal('');
  readonly showValidationErrors = signal(false);

  // Formulario del paso final
  readonly form = this.fb.nonNullable.group({
    name: [
      '',
      [
        Validators.required,
        Validators.maxLength(100),
        Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/),
      ],
    ],
    termsAccepted: [false, [Validators.requiredTrue]],
    privacyAccepted: [false, [Validators.requiredTrue]],
  });

  // Volver al paso anterior
  onBackClick(): void {
    this.back.emit();
  }

  // Acción final del paso
  submit(): void {
    this.generalError.set('');
    this.showValidationErrors.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const payload = {
      name: this.nameControl.value.trim(),
      termsAccepted: this.termsAcceptedControl.value,
      privacyAccepted: this.privacyAcceptedControl.value,
    };

    this.complete.emit(payload);
    this.isSubmitting.set(false);
  }

  // Helpers de acceso al formulario
  get nameControl() {
    return this.form.controls.name;
  }

  get termsAcceptedControl() {
    return this.form.controls.termsAccepted;
  }

  get privacyAcceptedControl() {
    return this.form.controls.privacyAccepted;
  }

  // Mensajes de error del nombre
  get nameError(): string {
    if (!this.showValidationErrors()) return '';

    if (this.nameControl.hasError('required')) {
      return 'El nombre es obligatorio';
    }

    if (this.nameControl.hasError('maxlength')) {
      return 'El nombre no puede superar los 100 caracteres';
    }

    if (this.nameControl.hasError('pattern')) {
      return 'Solo se permiten letras y espacios';
    }

    return '';
  }

  get termsError(): string {
    if (!this.showValidationErrors()) return '';
    if (this.termsAcceptedControl.hasError('required')) {
      return 'Debes aceptar los términos y condiciones';
    }
    return '';
  }

  get privacyError(): string {
    if (!this.showValidationErrors()) return '';
    if (this.privacyAcceptedControl.hasError('required')) {
      return 'Debes aceptar la política de privacidad';
    }
    return '';
  }
}