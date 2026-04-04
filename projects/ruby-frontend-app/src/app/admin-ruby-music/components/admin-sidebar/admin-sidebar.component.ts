import { Component, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideAngularModule,
  LayoutDashboard,
  Music,
  Tag,
  Disc3,
  Mic2,
  Library,
  Flag,
  LogOut,
  ChevronDown,
  ChevronRight,
  Users,
} from 'lucide-angular';

@Component({
  selector: 'rm-admin-sidebar',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './admin-sidebar.component.html',
  styleUrl: './admin-sidebar.component.scss',
})
export class AdminSidebarComponent {
  readonly isOpen = input(false);
  readonly closed = output<void>();

  private readonly router = inject(Router);

  readonly catalogoExpanded = signal(false);

  readonly LayoutDashboard = LayoutDashboard;
  readonly Music           = Music;
  readonly Tag             = Tag;
  readonly Disc3           = Disc3;
  readonly Mic2            = Mic2;
  readonly Library         = Library;
  readonly Flag            = Flag;
  readonly LogOut          = LogOut;
  readonly ChevronDown     = ChevronDown;
  readonly ChevronRight    = ChevronRight;
  readonly Users           = Users;

  close(): void { this.closed.emit(); }

  isActive(path: string): boolean {
    return this.router.url.startsWith(path);
  }

  isCatalogoActive(): boolean {
    return ['/admin/generos', '/admin/canciones', '/admin/albumes', '/admin/artistas']
      .some(p => this.router.url.startsWith(p));
  }

  /* Auto-expand catálogo when navigating to a sub-route */
  get catalogoShouldExpand(): boolean {
    return this.isCatalogoActive() || this.catalogoExpanded();
  }

  toggleCatalogo(): void {
    this.catalogoExpanded.update(v => !v);
  }

  navigate(path: string): void {
    this.close();
    this.router.navigate([path]);
  }

  logout(): void {
    this.close();
    this.router.navigate(['/auth']);
  }
}
