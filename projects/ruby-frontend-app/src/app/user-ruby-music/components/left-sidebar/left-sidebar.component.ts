import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NotificationsState } from '../../state/notifications.state';

interface SidebarItem {
  label: string;
  route: string;
  icon: string;
  alt: string;
}

@Component({
  selector: 'app-left-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './left-sidebar.component.html',
  styleUrls: ['./left-sidebar.component.scss'],
})
export class LeftSidebarComponent {
  private readonly notificationsState = inject(NotificationsState);

  /** Unseen notifications since the user last opened /user/notifications. */
  readonly unseenCount = this.notificationsState.unseenCount;

  /* ===================== */
  /* ITEMS DEL SIDEBAR */
  /* ===================== */
  readonly menuItems: SidebarItem[] = [
    {
      label: 'Notificaciones',
      route: '/user/notifications',
      icon: 'assets/icons/sidebar-notifications.png',
      alt: 'Icono de notificaciones',
    },
    {
      label: 'Activos estación', 
      route: '/user/chat-station',
      icon: 'assets/icons/sidebar-chat-station.png',
      alt: 'Icono de chat estación',
    },
    {
      label: 'Amigos',
      route: '/user/friends',
      icon: 'assets/icons/sidebar-friends.png',
      alt: 'Icono de amigos',
    },
    {
      label: 'Biblioteca',
      route: '/user/library',
      icon: 'assets/icons/sidebar-library.png',
      alt: 'Icono de biblioteca',
    },

  ];

}
