import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificationsState } from './user-ruby-music/state/notifications.state';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // Eager-inject NotificationsState at bootstrap so its token→realtime effect
  // runs from app start (opens the WS on login / page reload, closes on logout).
  private readonly notificationsState = inject(NotificationsState);
}
