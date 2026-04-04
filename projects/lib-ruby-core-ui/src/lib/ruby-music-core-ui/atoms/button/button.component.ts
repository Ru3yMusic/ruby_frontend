import { Component, input, output } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'google';
export type ButtonSize    = 'sm' | 'md' | 'lg';

@Component({
  selector: 'rm-button',
  standalone: true,
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
})
export class ButtonComponent {
  variant  = input<ButtonVariant>('primary');
  size     = input<ButtonSize>('lg');
  type     = input<'button' | 'submit'>('button');
  disabled = input(false);
  loading  = input(false);
  clicked  = output<void>();

  get hostClass(): string {
    return `btn--${this.variant()} btn--${this.size()}`;
  }
}
