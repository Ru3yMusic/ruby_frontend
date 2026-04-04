import {
  Component,
  ElementRef,
  output,
  QueryList,
  signal,
  ViewChildren,
} from '@angular/core';

@Component({
  selector: 'rm-otp-input-group',
  standalone: true,
  templateUrl: './otp-input-group.component.html',
  styleUrl: './otp-input-group.component.scss',
})
export class OtpInputGroupComponent {
  @ViewChildren('otpInput') inputs!: QueryList<ElementRef<HTMLInputElement>>;

  readonly length  = 6;
  readonly indices = Array.from({ length: this.length }, (_, i) => i);

  digits    = signal<string[]>(Array(this.length).fill(''));
  completed = output<string>();

  onInput(e: Event, idx: number): void {
    const raw = (e.target as HTMLInputElement).value
      .replace(/\D/g, '')
      .slice(-1);

    this.setDigit(idx, raw);
    if (raw && idx < this.length - 1) this.focusBox(idx + 1);
    this.checkComplete();
  }

  onKeyDown(e: KeyboardEvent, idx: number): void {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (this.digits()[idx]) {
        this.setDigit(idx, '');
      } else if (idx > 0) {
        this.setDigit(idx - 1, '');
        this.focusBox(idx - 1);
      }
    } else if (e.key === 'ArrowLeft'  && idx > 0)              this.focusBox(idx - 1);
    else if   (e.key === 'ArrowRight' && idx < this.length - 1) this.focusBox(idx + 1);
  }

  onPaste(e: ClipboardEvent): void {
    e.preventDefault();
    const text = (e.clipboardData?.getData('text') ?? '')
      .replace(/\D/g, '')
      .slice(0, this.length);

    const arr = this.digits().slice();
    text.split('').forEach((ch, i) => { arr[i] = ch; });
    this.digits.set(arr);
    this.syncInputValues();
    this.focusBox(Math.min(text.length, this.length - 1));
    this.checkComplete();
  }

  reset(): void {
    this.digits.set(Array(this.length).fill(''));
    this.syncInputValues();
    this.focusBox(0);
  }

  // ── Private helpers ───────────────────────────────────────────────────
  private setDigit(idx: number, val: string): void {
    const arr = this.digits().slice();
    arr[idx]  = val;
    this.digits.set(arr);
    const el = this.inputs?.get(idx)?.nativeElement;
    if (el) el.value = val;
  }

  private focusBox(idx: number): void {
    this.inputs?.get(idx)?.nativeElement.focus();
  }

  private syncInputValues(): void {
    this.inputs?.forEach((el, i) => {
      el.nativeElement.value = this.digits()[i];
    });
  }

  private checkComplete(): void {
    const code = this.digits().join('');
    if (code.length === this.length) this.completed.emit(code);
  }
}
