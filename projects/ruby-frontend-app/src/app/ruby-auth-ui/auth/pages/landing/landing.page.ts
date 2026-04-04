import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LandingHeroComponent } from 'lib-ruby-core-ui';

@Component({
  selector: 'rm-landing',
  standalone: true,
  imports: [LandingHeroComponent],
  template: `<rm-landing-hero (googleClicked)="onGoogle()"/>`,
})
export class LandingPage {
  private readonly router = inject(Router);

  onGoogle(): void {
    // Google OAuth integration point
    console.log('Google login');
  }
}
