import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Heart, Users, Trash2, ChevronLeft } from 'lucide-angular';

type NotifTab = 'actividad' | 'solicitudes';

export interface ActivityNotif {
  id: string;
  user: string;
  avatar: string;
  text: string;
  time: string;
}

export interface RequestNotif {
  id: string;
  user: string;
  avatar: string;
  status: 'pending' | 'accepted' | 'rejected';
}

@Component({
  selector: 'rm-notifications-page',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './notifications.page.html',
  styleUrl: './notifications.page.scss',
})
export class NotificationsPage {
  readonly Heart       = Heart;
  readonly Users       = Users;
  readonly Trash2      = Trash2;
  readonly ChevronLeft = ChevronLeft;
  readonly tab = signal<NotifTab>('actividad');

  readonly activities = signal<ActivityNotif[]>([
    { id: 'n1', user: '@Juan',    avatar: 'J', text: 'le dio me gusta a tu comentario.',          time: 'Hace 5 min' },
    { id: 'n2', user: '@Eduardo', avatar: 'E', text: 'le dio me gusta a tu comentario.',          time: 'Hace 18 min' },
    { id: 'n3', user: '@Gerardo', avatar: 'G', text: 'te ha mencionado en la estación Pop.',      time: 'Hace 1 h' },
    { id: 'n4', user: '@Sofia',   avatar: 'S', text: 'le dio me gusta a tu comentario.',          time: 'Hace 3 h' },
  ]);

  readonly requests = signal<RequestNotif[]>([
    { id: 'r1', user: '@Ricardo', avatar: 'R', status: 'pending' },
    { id: 'r2', user: '@Camila',  avatar: 'C', status: 'pending' },
  ]);

  readonly pendingRequests = computed(() => this.requests().filter(r => r.status === 'pending'));
  readonly requestsBadge = computed(() => this.pendingRequests().length);

  readonly totalToday = computed(() =>
    this.activities().length + this.pendingRequests().length,
  );

  // Actividad: menú ⋮ por ítem
  readonly openMenuId = signal<string | null>(null);
  // Banner de conexión aceptada
  readonly acceptedUser = signal<string | null>(null);

  toggleMenu(id: string): void {
    this.openMenuId.update(current => (current === id ? null : id));
  }

  deleteNotification(id: string): void {
    this.activities.update(list => list.filter(n => n.id !== id));
    this.openMenuId.set(null);
  }

  acceptRequest(id: string): void {
    const req = this.requests().find(r => r.id === id);
    if (!req) return;
    this.requests.update(list =>
      list.map(r => (r.id === id ? { ...r, status: 'accepted' } : r)),
    );
    this.acceptedUser.set(req.user);
    setTimeout(() => this.acceptedUser.set(null), 4000);
  }

  rejectRequest(id: string): void {
    this.requests.update(list =>
      list.map(r => (r.id === id ? { ...r, status: 'rejected' } : r)),
    );
  }

  closeMenu(): void {
    this.openMenuId.set(null);
  }
}
