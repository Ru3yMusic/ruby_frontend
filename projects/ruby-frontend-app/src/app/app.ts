import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
// ─── KILL SWITCH (debug freeze) ────────────────────────────────────────────
// Both eager injections desactivados temporalmente para aislar el freeze de
// /user/home. Si el freeze desaparece, uno de estos servicios contiene el loop.
// import { SessionKeepaliveService } from './core/services/session-keepalive.service';
// import { NotificationsState } from './user-ruby-music/state/notifications.state';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // KILL SWITCH: SessionKeepaliveService y NotificationsState desactivados.
  // private readonly sessionKeepalive = inject(SessionKeepaliveService);
  // private readonly notificationsState = inject(NotificationsState);
}
