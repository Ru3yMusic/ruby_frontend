import { Component, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideAngularModule,
  Pencil, Bell, Users, MessageCircle, LogOut, Plus,
} from 'lucide-angular';
import { UserProfileState } from '../../state/user-profile.state';

@Component({
  selector: 'rm-drawer-menu',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './drawer-menu.component.html',
  styleUrl: './drawer-menu.component.scss',
})
export class DrawerMenuComponent {
  readonly isOpen = input(false);
  readonly closed = output<void>();

  readonly profileState = inject(UserProfileState);
  private readonly router = inject(Router);

  readonly Pencil        = Pencil;
  readonly Bell          = Bell;
  readonly Users         = Users;
  readonly MessageCircle = MessageCircle;
  readonly LogOut        = LogOut;
  readonly Plus          = Plus;

  close(): void { this.closed.emit(); }

  goEditProfile():   void { this.close(); this.router.navigate(['/profile/edit']); }
  goNotifications(): void { this.close(); this.router.navigate(['/notifications']); }
  goAmigos():        void { this.close(); this.router.navigate(['/amigos']); }
  goChatEstacion():  void { this.close(); this.router.navigate(['/chat-estacion']); }
  logout():          void { this.close(); this.router.navigate(['/auth']); }
}
