import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

type HomeTab = 'TODAS' | 'MUSICA' | 'ESTACION';

@Component({
  selector: 'app-music',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './music.component.html',
  styleUrls: ['./music.component.scss'],
})
export class MusicComponent {
  private readonly router = inject(Router);

  setActiveTab(tab: HomeTab): void {
    if (tab === 'TODAS') {
      this.router.navigate(['/user/home']);
      return;
    }

    if (tab === 'MUSICA') {
      this.router.navigate(['/user/music']);
      return;
    }

    if (tab === 'ESTACION') {
      this.router.navigate(['/user/station']);
    }
  }

  isTabActive(tab: HomeTab): boolean {
    const currentUrl = this.router.url;

    if (tab === 'TODAS') {
      return currentUrl === '/user/home';
    }

    if (tab === 'MUSICA') {
      return currentUrl === '/user/music';
    }

    if (tab === 'ESTACION') {
      return currentUrl === '/user/station';
    }

    return false;
  }
}