import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Search, Trash2, ChevronLeft } from 'lucide-angular';

export interface Friend {
  id: string;
  user: string;
  avatar: string;
  color: string;
  active: boolean;
}

@Component({
  selector: 'rm-amigos-page',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './amigos.page.html',
  styleUrl: './amigos.page.scss',
})
export class AmigosPage {
  readonly Search      = Search;
  readonly Trash2      = Trash2;
  readonly ChevronLeft = ChevronLeft;
  readonly search = signal('');
  readonly selectedId = signal<string | null>(null);

  // Estado del undo
  readonly undoFriend = signal<Friend | null>(null);
  private undoTimer: ReturnType<typeof setTimeout> | null = null;

  readonly friends = signal<Friend[]>([
    { id: 'f1', user: '@Carolina', avatar: 'C', color: '#7f2e8f', active: true  },
    { id: 'f2', user: '@Martin',   avatar: 'M', color: '#1a7b61', active: false },
    { id: 'f3', user: '@Gerardo',  avatar: 'G', color: '#153f6e', active: true  },
    { id: 'f4', user: '@Juan',     avatar: 'J', color: '#8c5a26', active: true  },
    { id: 'f5', user: '@Mahavi',   avatar: 'A', color: '#3a3c48', active: false },
    { id: 'f6', user: '@Mahavi_2', avatar: 'A', color: '#2c3e50', active: false },
  ]);

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.friends();
    return this.friends().filter(f => f.user.toLowerCase().includes(q));
  });

  readonly count = computed(() => this.friends().length);

  readonly selectedFriend = computed(() =>
    this.friends().find(f => f.id === this.selectedId()) ?? null,
  );

  toggleMenu(id: string): void {
    this.selectedId.update(current => (current === id ? null : id));
  }

  closeMenu(): void {
    this.selectedId.set(null);
  }

  deleteFriend(): void {
    const target = this.selectedFriend();
    if (!target) return;

    // Eliminar
    this.friends.update(list => list.filter(f => f.id !== target.id));
    this.selectedId.set(null);

    // Preparar undo
    this.undoFriend.set(target);
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.undoTimer = setTimeout(() => this.undoFriend.set(null), 3000);
  }

  undo(): void {
    const target = this.undoFriend();
    if (!target) return;
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.friends.update(list => {
      // Reinserta en la posición original aproximada (al final de su grupo activo/inactivo)
      const actives   = list.filter(f => f.active);
      const inactives = list.filter(f => !f.active);
      return target.active
        ? [...actives, target, ...inactives]
        : [...actives, ...inactives, target];
    });
    this.undoFriend.set(null);
  }
}
