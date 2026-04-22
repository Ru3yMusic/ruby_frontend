import { Component, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthRepositoryPort } from 'lib-ruby-core';
import { finalize } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { TokenStorageService } from '../../../core/services/token-storage.service';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
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
  Radio,
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
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly authState = inject(AuthState);
  private readonly authRepo = inject(AuthRepositoryPort);

  // =========================
  // ESTADO UI
  // =========================
  readonly catalogoExpanded = signal(false);

  // =========================
  // ICONOS
  // =========================
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
  readonly Radio           = Radio; 

  // =========================
  // ACCIONES
  // =========================
  close(): void {
    this.closed.emit();
  }

  navigate(path: string): void {
    this.close();

    // 
    if (this.router.url !== path) {
      this.router.navigateByUrl(path);
    }
  }

  logout(): void {
    this.close();

    const refreshToken = this.tokenStorage.getRefreshToken();

    const finalizeLogout = () => {
      this.tokenStorage.clearTokens();
      this.authState.clearSession();
      this.router.navigateByUrl('/auth/welcome');
    };

    const request$ = refreshToken
      ? this.authRepo.logout(refreshToken)
      : EMPTY;

    request$.pipe(finalize(finalizeLogout)).subscribe({
      error: () => {
        // el backend puede fallar (token expirado / red);
        // finalize igual limpia sesión y redirige.
      },
    });
  }

  // =========================
  // ACTIVE STATES
  // =========================
  isActive(path: string): boolean {
    return this.router.url.startsWith(path);
  }

  isCatalogoActive(): boolean {
    return [
      '/admin/generos',
      '/admin/canciones',
      '/admin/albumes',
      '/admin/artistas',
      '/admin/estaciones', //  NUEVO
    ].some(p => this.router.url.startsWith(p));
  }

  // =========================
  // EXPANSIÓN CATÁLOGO
  // =========================
  get catalogoShouldExpand(): boolean {
    return this.isCatalogoActive() || this.catalogoExpanded();
  }

  toggleCatalogo(): void {
    this.catalogoExpanded.update(v => !v);
  }
}