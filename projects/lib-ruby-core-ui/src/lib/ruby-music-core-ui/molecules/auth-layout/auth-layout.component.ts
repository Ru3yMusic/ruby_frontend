import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackButtonComponent } from '../../atoms/back-button/back-button.component';
import { LogoComponent } from '../../atoms/logo/logo.component';
import { ProgressDotsComponent } from '../../atoms/progress-dots/progress-dots.component';

@Component({
  selector: 'rm-auth-layout',
  standalone: true,
  imports: [CommonModule, BackButtonComponent, LogoComponent, ProgressDotsComponent],
  template: `
    <div class="layout" [class]="'layout--' + theme()">
      <!-- Top bar -->
      <div class="layout__topbar">
        @if (showBack()) {
          <rm-back-button/>
        } @else {
          <div class="layout__topbar-spacer"></div>
        }
        @if (showLogo()) {
          <rm-logo size="sm"/>
        }
        <div class="layout__topbar-spacer"></div>
      </div>

      <!-- Content -->
      <div class="layout__content">
        <ng-content/>
      </div>

      <!-- Footer with progress dots -->
      @if (totalSteps() > 0) {
        <div class="layout__footer">
          <rm-progress-dots [total]="totalSteps()" [current]="currentStep()"/>
        </div>
      }
    </div>
  `,
  styles: [`
    .layout {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      padding: 0 24px;
      box-sizing: border-box;
    }

    /* Dark theme (landing, login, forgot-password) */
    .layout--dark {
      background: linear-gradient(180deg, #0f0808 0%, #1a0a0a 60%, #0d0606 100%);
    }

    /* Red theme (register steps) */
    .layout--red {
      background: linear-gradient(180deg, #4a0a0a 0%, #7a0a12 35%, #3d0508 100%);
    }

    .layout__topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 52px 0 20px;
    }

    .layout__topbar-spacer { width: 38px; }

    .layout__content {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .layout__footer {
      padding: 20px 0 36px;
      display: flex;
      justify-content: center;
    }
  `],
})
export class AuthLayoutComponent {
  theme       = input<'dark' | 'red'>('dark');
  showBack    = input(false);
  showLogo    = input(true);
  totalSteps  = input(0);
  currentStep = input(1);
}
