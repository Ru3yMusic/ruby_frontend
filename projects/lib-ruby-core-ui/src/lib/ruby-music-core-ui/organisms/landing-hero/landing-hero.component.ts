import { Component, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogoComponent } from '../../atoms/logo/logo.component';
import { ButtonComponent } from '../../atoms/button/button.component';

@Component({
  selector: 'rm-landing-hero',
  standalone: true,
  imports: [RouterLink, LogoComponent, ButtonComponent],
  templateUrl: './landing-hero.component.html',
  styleUrl: './landing-hero.component.scss',
})
export class LandingHeroComponent {
  googleClicked = output<void>();
}
