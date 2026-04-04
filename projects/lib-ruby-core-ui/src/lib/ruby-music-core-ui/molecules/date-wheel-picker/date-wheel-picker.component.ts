import { AfterViewInit, Component, ElementRef, output, signal, ViewChild } from '@angular/core';

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const ITEM_H    = 44; // px — must match scss

@Component({
  selector: 'rm-date-wheel-picker',
  standalone: true,
  templateUrl: './date-wheel-picker.component.html',
  styleUrl: './date-wheel-picker.component.scss',
})
export class DateWheelPickerComponent implements AfterViewInit {
  @ViewChild('dayCol')   dayColRef!:   ElementRef<HTMLElement>;
  @ViewChild('monthCol') monthColRef!: ElementRef<HTMLElement>;
  @ViewChild('yearCol')  yearColRef!:  ElementRef<HTMLElement>;

  dateChanged = output<string>();

  readonly days   = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  readonly months = MONTHS_ES;
  readonly years  = Array.from({ length: 100 }, (_, i) => String(new Date().getFullYear() - i));

  private selectedDay   = signal(new Date().getDate());
  private selectedMonth = signal(new Date().getMonth() + 1);
  private selectedYear  = signal(new Date().getFullYear() - 18);

  ngAfterViewInit(): void {
    this.dayColRef.nativeElement.scrollTop   = (this.selectedDay() - 1)   * ITEM_H;
    this.monthColRef.nativeElement.scrollTop = (this.selectedMonth() - 1) * ITEM_H;
    const yearIdx = this.years.indexOf(String(this.selectedYear()));
    this.yearColRef.nativeElement.scrollTop  = yearIdx * ITEM_H;
  }

  onScroll(col: 'day' | 'month' | 'year', e: Event): void {
    const idx = Math.round((e.target as HTMLElement).scrollTop / ITEM_H);
    if (col === 'day')   this.selectedDay.set(idx + 1);
    if (col === 'month') this.selectedMonth.set(idx + 1);
    if (col === 'year')  this.selectedYear.set(Number(this.years[idx] ?? this.years[0]));
    this.emitDate();
  }

  private emitDate(): void {
    const d = String(this.selectedDay()).padStart(2, '0');
    const m = String(this.selectedMonth()).padStart(2, '0');
    const y = this.selectedYear();
    this.dateChanged.emit(`${y}-${m}-${d}`);
  }
}
