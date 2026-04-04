import { Component, input } from '@angular/core';
import { BackButtonComponent } from '../../atoms/back-button/back-button.component';
import { LogoComponent } from '../../atoms/logo/logo.component';
import { ProgressDotsComponent } from '../../atoms/progress-dots/progress-dots.component';

export type AuthTheme = 'dark' | 'red';

@Component({
  selector: 'rm-auth-template',
  standalone: true,
  imports: [BackButtonComponent, LogoComponent, ProgressDotsComponent],
  templateUrl: './auth-template.component.html',
  styleUrl: './auth-template.component.scss',
})
export class AuthTemplateComponent {
  theme       = input<AuthTheme>('dark');
  showBack    = input(false);
  showLogo    = input(true);
  totalSteps  = input(0);
  currentStep = input(1);
}
