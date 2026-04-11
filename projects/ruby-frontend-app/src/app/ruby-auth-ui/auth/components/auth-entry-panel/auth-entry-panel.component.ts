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

  onGoogleClick(): void {
    console.log('Google login mock');
  }
}