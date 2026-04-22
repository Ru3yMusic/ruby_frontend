import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-auth-entry-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auth-entry-panel.component.html',
  styleUrl: './auth-entry-panel.component.scss',
})
export class AuthEntryPanelComponent {
  @Output() loginClick = new EventEmitter<void>();
  @Output() registerClick = new EventEmitter<void>();

  onLoginClick(): void {
    this.loginClick.emit();
  }

  onRegisterClick(): void {
    this.registerClick.emit();
  }

  // Google OAuth aún no está implementado en backend (auth-service devuelve
  // UnsupportedOperationException). El botón sigue visible en UI para mantener
  // el placeholder visual, pero queda disabled hasta que se conecte el endpoint.
  readonly isGoogleDisabled = true;
}