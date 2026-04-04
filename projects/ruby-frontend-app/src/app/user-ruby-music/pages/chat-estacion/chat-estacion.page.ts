import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, ChevronLeft } from 'lucide-angular';

interface FriendStation {
  id: string;
  user: string;
  avatar: string;
  station: string;
  slug: string;
  color: string;
}

@Component({
  selector: 'rm-chat-estacion-page',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './chat-estacion.page.html',
  styleUrl: './chat-estacion.page.scss',
})
export class ChatEstacionPage {
  private readonly router = inject(Router);
  readonly ChevronLeft = ChevronLeft;

  readonly friends: FriendStation[] = [
    { id: 'f1', user: '@Alberto', avatar: 'A', station: 'Rock',    slug: 'Rock',    color: '#7f2e8f' },
    { id: 'f2', user: '@Eduardo', avatar: 'E', station: 'Pop',     slug: 'Pop',     color: '#3f97a0' },
    { id: 'f3', user: '@Juan',    avatar: 'J', station: 'Bachata', slug: 'Bachata', color: '#2a8cb6' },
  ];

  join(friend: FriendStation): void {
    this.router.navigate(['/station', friend.slug], {
      queryParams: { friend: friend.user },
    });
  }
}
