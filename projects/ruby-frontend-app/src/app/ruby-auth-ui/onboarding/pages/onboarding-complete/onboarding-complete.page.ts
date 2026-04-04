import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent, OnboardingTemplateComponent } from 'lib-ruby-core-ui';

@Component({
  selector: 'rm-onboarding-complete',
  standalone: true,
  imports: [OnboardingTemplateComponent, ButtonComponent],
  templateUrl: './onboarding-complete.page.html',
  styleUrl: './onboarding-complete.page.scss',
})
export class OnboardingCompletePage {
  private router = inject(Router);

  onListen(): void { this.router.navigate(['/home']); }
  onSkip():   void { this.router.navigate(['/home']); }
}
