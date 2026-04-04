import { Component, input } from '@angular/core';

export type LogoSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'rm-logo',
  standalone: true,
  templateUrl: './logo.component.html',
  styleUrl: './logo.component.scss',
})
export class LogoComponent {
  size = input<LogoSize>('md');
}
