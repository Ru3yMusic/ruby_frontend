import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, signal } from '@angular/core';

type GenderOption =
  | 'FEMENINO'
  | 'MASCULINO'
  | 'NO_BINARIO'
  | 'OTRO'
  | 'PREFIERO_NO_DECIR';

interface GenderItem {
  value: GenderOption;
  label: string;
  description: string;
}

@Component({
  selector: 'app-register-gender-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './register-gender-step.component.html',
  styleUrl: './register-gender-step.component.scss',
})
export class RegisterGenderStepComponent {
  // Eventos para navegar entre pasos
  @Output() back = new EventEmitter<void>();
  @Output() next = new EventEmitter<{ gender: GenderOption }>();

  // Estado visual del componente
  readonly isSubmitting = signal(false);
  readonly generalError = signal('');
  readonly showValidationErrors = signal(false);

  // Opción seleccionada
  readonly selectedGender = signal<GenderOption | null>(null);

  // Opciones disponibles
  readonly genderOptions: GenderItem[] = [
    {
      value: 'FEMENINO',
      label: 'Femenino',
      description: 'Selecciona esta opción si te identificas como mujer.',
    },
    {
      value: 'MASCULINO',
      label: 'Masculino',
      description: 'Selecciona esta opción si te identificas como hombre.',
    },
    {
      value: 'NO_BINARIO',
      label: 'No binario',
      description: 'Para una identidad fuera del binario tradicional.',
    },
    {
      value: 'OTRO',
      label: 'Otro',
      description: 'Elige esta opción si prefieres otra identidad.',
    },
    {
      value: 'PREFIERO_NO_DECIR',
      label: 'Prefiero no decirlo',
      description: 'Puedes continuar sin compartir esta información.',
    },
  ];

  // Acción para volver al paso anterior
  onBackClick(): void {
    this.back.emit();
  }

  // Acción para seleccionar una opción
  selectGender(value: GenderOption): void {
    this.selectedGender.set(value);
    this.generalError.set('');
  }

  // Acción principal del paso
  submit(): void {
    this.showValidationErrors.set(true);
    this.generalError.set('');

    const selected = this.selectedGender();

    if (!selected) {
      this.generalError.set('Selecciona una opción para continuar');
      return;
    }

    this.isSubmitting.set(true);

    const payload = {
      gender: selected,
    };

    console.log('Register gender step:', payload);

    this.next.emit(payload);
    this.isSubmitting.set(false);
  }

  // Helper visual para marcar la tarjeta activa
  isSelected(value: GenderOption): boolean {
    return this.selectedGender() === value;
  }
}