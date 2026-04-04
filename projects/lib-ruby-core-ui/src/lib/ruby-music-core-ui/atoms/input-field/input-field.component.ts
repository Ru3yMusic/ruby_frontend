import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule, Eye, EyeOff } from 'lucide-angular';

@Component({
  selector: 'rm-input',
  standalone: true,
  imports: [ReactiveFormsModule, LucideAngularModule],
  templateUrl: './input-field.component.html',
  styleUrl: './input-field.component.scss',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => InputFieldComponent),
    multi: true,
  }],
})
export class InputFieldComponent implements ControlValueAccessor {
  // ── Inputs ────────────────────────────────────────────────────────────
  type        = input<'text' | 'email' | 'password'>('text');
  placeholder = input('');
  hint        = input('');
  error       = input('');

  // ── Internal state ────────────────────────────────────────────────────
  protected value        = signal('');
  protected isDisabled   = signal(false);
  protected showPassword = signal(false);
  readonly Eye    = Eye;
  readonly EyeOff = EyeOff;

  // ── CVA ───────────────────────────────────────────────────────────────
  private onChange  = (_: string) => {};
  onTouched         = () => {};

  writeValue(val: string): void      { this.value.set(val ?? ''); }
  registerOnChange(fn: any): void    { this.onChange = fn; }
  registerOnTouched(fn: any): void   { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.isDisabled.set(d); }

  onInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.value.set(v);
    this.onChange(v);
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  get resolvedType(): string {
    if (this.type() === 'password') {
      return this.showPassword() ? 'text' : 'password';
    }
    return this.type();
  }
}
