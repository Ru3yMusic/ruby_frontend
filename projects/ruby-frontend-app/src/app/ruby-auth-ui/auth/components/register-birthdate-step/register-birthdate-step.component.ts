import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
  signal,
} from '@angular/core';

interface MonthOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-register-birthdate-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './register-birthdate-step.component.html',
  styleUrl: './register-birthdate-step.component.scss',
})
export class RegisterBirthdateStepComponent implements AfterViewInit {
  // Eventos para navegar entre pasos
  @Output() back = new EventEmitter<void>();
  @Output() next = new EventEmitter<{ birthDate: string }>();

  // Referencias directas a las 3 columnas del selector
  @ViewChild('dayColumn') dayColumnRef!: ElementRef<HTMLDivElement>;
  @ViewChild('monthColumn') monthColumnRef!: ElementRef<HTMLDivElement>;
  @ViewChild('yearColumn') yearColumnRef!: ElementRef<HTMLDivElement>;

  // Estado visual
  readonly isSubmitting = signal(false);
  readonly generalError = signal('');

  // Configuración visual del picker
  readonly itemHeight = 56;
  readonly visiblePaddingItems = 2;

  // Meses completos
  readonly months: MonthOption[] = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
  ];

  // Año actual real
  readonly currentYear = new Date().getFullYear();

  // Lista de años: desde año actual hacia atrás
  readonly years: number[] = this.buildYears();

  // Días dinámicos según mes/año seleccionado
  days: number[] = [];

  // Selección actual inicial
  selectedDay = signal(1);
  selectedMonth = signal(1);
  selectedYear = signal(this.currentYear);

  // Timers para snap tras el scroll
  private dayScrollTimeout: ReturnType<typeof setTimeout> | null = null;
  private monthScrollTimeout: ReturnType<typeof setTimeout> | null = null;
  private yearScrollTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.rebuildDays();
  }

  ngAfterViewInit(): void {
    // Espera a que el DOM termine de renderizar y centra las 3 columnas
    setTimeout(() => {
      this.centerAllColumns(false);
    }, 0);
  }

  // Navegación
  onBackClick(): void {
    this.back.emit();
  }

  submit(): void {
    this.generalError.set('');

    const validationError = this.validateBirthDate();

    if (validationError) {
      this.generalError.set(validationError);
      return;
    }

    this.isSubmitting.set(true);

    const payload = {
      birthDate: this.buildBirthDateString(),
    };

    console.log('Register birthdate step:', payload);

    this.next.emit(payload);
    this.isSubmitting.set(false);
  }

  // Scroll de día
  onDayScroll(event: Event): void {
    const target = event.target as HTMLDivElement;

    if (this.dayScrollTimeout) {
      clearTimeout(this.dayScrollTimeout);
    }

    this.dayScrollTimeout = setTimeout(() => {
      this.snapColumn(target, 'day');
    }, 90);
  }

  // Scroll de mes
  onMonthScroll(event: Event): void {
    const target = event.target as HTMLDivElement;

    if (this.monthScrollTimeout) {
      clearTimeout(this.monthScrollTimeout);
    }

    this.monthScrollTimeout = setTimeout(() => {
      this.snapColumn(target, 'month');
    }, 90);
  }

  // Scroll de año
  onYearScroll(event: Event): void {
    const target = event.target as HTMLDivElement;

    if (this.yearScrollTimeout) {
      clearTimeout(this.yearScrollTimeout);
    }

    this.yearScrollTimeout = setTimeout(() => {
      this.snapColumn(target, 'year');
    }, 90);
  }

  // Control manual del wheel para avanzar de uno en uno
  onColumnWheel(event: WheelEvent, type: 'day' | 'month' | 'year'): void {
    event.preventDefault();

    const container = event.currentTarget as HTMLDivElement;
    const direction = event.deltaY > 0 ? 1 : -1;

    let currentIndex = 0;

    if (type === 'day') {
      currentIndex = this.days.findIndex(day => day === this.selectedDay());
    } else if (type === 'month') {
      currentIndex = this.months.findIndex(
        month => month.value === this.selectedMonth()
      );
    } else {
      currentIndex = this.years.findIndex(
        year => year === this.selectedYear()
      );
    }

    const nextIndex = this.clampIndexByType(currentIndex + direction, type);
    const nextTop = nextIndex * this.itemHeight;

    container.scrollTo({
      top: nextTop,
      behavior: 'smooth',
    });

    if (type === 'day') {
      const value = this.days[nextIndex];
      if (value != null) {
        this.selectedDay.set(value);
      }
      return;
    }

    if (type === 'month') {
      const value = this.months[nextIndex];
      if (value) {
        this.selectedMonth.set(value.value);
        this.adjustDayIfNeeded();
      }
      return;
    }

    const year = this.years[nextIndex];
    if (year != null) {
      this.selectedYear.set(year);
      this.adjustDayIfNeeded();
    }
  }

  // Datos con padding visual arriba y abajo
  get paddedDays(): Array<number | null> {
    return this.withPadding(this.days);
  }

  get paddedMonths(): Array<MonthOption | null> {
    return this.withPadding(this.months);
  }

  get paddedYears(): Array<number | null> {
    return this.withPadding(this.years);
  }

  // Comparadores visuales para resaltar el valor activo
  isDaySelected(day: number | null): boolean {
    return day === this.selectedDay();
  }

  isMonthSelected(month: MonthOption | null): boolean {
    return month?.value === this.selectedMonth();
  }

  isYearSelected(year: number | null): boolean {
    return year === this.selectedYear();
  }

  trackByValue(index: number, item: number | MonthOption | null): string | number {
    if (item === null) return `empty-${index}`;
    if (typeof item === 'number') return item;
    return item.value;
  }

  trackByMonth(index: number, item: MonthOption | null): string | number {
    if (item === null) return `empty-${index}`;
    return item.value;
  }

  // Snap general de columna
  private snapColumn(
    container: HTMLDivElement,
    type: 'day' | 'month' | 'year'
  ): void {
    const rawIndex = Math.round(container.scrollTop / this.itemHeight);
    const clampedIndex = this.clampIndexByType(rawIndex, type);
    const snappedTop = clampedIndex * this.itemHeight;

    container.scrollTo({
      top: snappedTop,
      behavior: 'smooth',
    });

    if (type === 'day') {
      const value = this.days[clampedIndex];
      if (value != null) {
        this.selectedDay.set(value);
      }
      return;
    }

    if (type === 'month') {
      const value = this.months[clampedIndex];
      if (value) {
        this.selectedMonth.set(value.value);
        this.adjustDayIfNeeded();
      }
      return;
    }

    const year = this.years[clampedIndex];
    if (year != null) {
      this.selectedYear.set(year);
      this.adjustDayIfNeeded();
    }
  }

  // Limita índices válidos según columna
  private clampIndexByType(index: number, type: 'day' | 'month' | 'year'): number {
    const maxIndex =
      type === 'day'
        ? this.days.length - 1
        : type === 'month'
        ? this.months.length - 1
        : this.years.length - 1;

    return Math.max(0, Math.min(index, maxIndex));
  }

  // Centra todas las columnas al entrar
  private centerAllColumns(smooth = false): void {
    this.scrollToSelected('day', smooth);
    this.scrollToSelected('month', smooth);
    this.scrollToSelected('year', smooth);
  }

  // Lleva visualmente el scroll al elemento seleccionado
  private scrollToSelected(
    type: 'day' | 'month' | 'year',
    smooth = true
  ): void {
    let container: HTMLDivElement | null = null;
    let selectedIndex = 0;

    if (type === 'day') {
      container = this.dayColumnRef?.nativeElement ?? null;
      selectedIndex = this.days.findIndex(day => day === this.selectedDay());
    } else if (type === 'month') {
      container = this.monthColumnRef?.nativeElement ?? null;
      selectedIndex = this.months.findIndex(
        month => month.value === this.selectedMonth()
      );
    } else {
      container = this.yearColumnRef?.nativeElement ?? null;
      selectedIndex = this.years.findIndex(
        year => year === this.selectedYear()
      );
    }

    if (!container || selectedIndex < 0) return;

    container.scrollTo({
      top: selectedIndex * this.itemHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }

  // Validaciones
  private validateBirthDate(): string {
    const year = this.selectedYear();
    const month = this.selectedMonth();
    const day = this.selectedDay();

    const date = new Date(year, month - 1, day);

    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return 'Selecciona una fecha válida';
    }

    const age = this.calculateAge(date);

    if (age < 13) {
      return 'Debes ser mayor de 13 años para usar RubyTune';
    }

    return '';
  }

  private calculateAge(birthDate: Date): number {
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();

    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }

  // Recalcula la cantidad de días según mes y año
  private rebuildDays(): void {
    const totalDays = new Date(
      this.selectedYear(),
      this.selectedMonth(),
      0
    ).getDate();

    this.days = Array.from({ length: totalDays }, (_, index) => index + 1);
  }

  // Ajusta el día si el mes/año cambia y el día actual deja de existir
  private adjustDayIfNeeded(): void {
    const currentDay = this.selectedDay();

    this.rebuildDays();

    if (currentDay > this.days.length) {
      this.selectedDay.set(this.days.length);
    }

    setTimeout(() => {
      this.scrollToSelected('day');
    }, 0);
  }

  // Genera años desde el año actual hacia atrás
  private buildYears(): number[] {
    const minYear = this.currentYear - 80;
    const years: number[] = [];

    for (let year = this.currentYear; year >= minYear; year--) {
      years.push(year);
    }

    return years;
  }

  // Agrega espacios vacíos arriba y abajo para centrar visualmente
  private withPadding<T>(items: T[]): Array<T | null> {
    const padding = Array.from(
      { length: this.visiblePaddingItems },
      () => null
    );
    return [...padding, ...items, ...padding];
  }

  // Formato final YYYY-MM-DD
  private buildBirthDateString(): string {
    const year = this.selectedYear();
    const month = String(this.selectedMonth()).padStart(2, '0');
    const day = String(this.selectedDay()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}