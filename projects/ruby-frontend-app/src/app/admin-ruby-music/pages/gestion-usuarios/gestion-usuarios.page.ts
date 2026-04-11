import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import {
  Check,
  Eye,
  LucideAngularModule,
  Menu,
  Pencil,
  Search,
} from 'lucide-angular';

import { AdminSidebarComponent } from '../../components/admin-sidebar/admin-sidebar.component';

/* =========================
   TIPOS / MODELOS
========================= */
type UserStatus = 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  status: UserStatus;
  createdAt: string;
  reportCount: number;
  blockReason: string | null;
  blockedAt: string | null;
}

interface AuthUser {
  id: string;
  email: string;
  password: string;
  authProvider: 'EMAIL';
  name: string;
  birthDate: string;
  gender: string;
  avatarUrl: string | null;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'BLOCKED' | 'INACTIVE';
  blockReason: string | null;
  blockedAt: string | null;
  onboardingCompleted: boolean;
  selectedStationIds: string[];
  createdAt: string;
}

/* =========================
   COMPONENTE
========================= */
@Component({
  selector: 'app-gestion-usuarios-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, AdminSidebarComponent],
  templateUrl: './gestion-usuarios.page.html',
  styleUrl: './gestion-usuarios.page.scss',
})
export class GestionUsuariosPage {
  /* =========================
     STORAGE KEYS
  ========================= */
  private readonly USERS_KEY = 'ruby_users';
  private readonly AUTH_USERS_KEY = 'ruby_auth_users';

  /* =========================
     ICONOS
  ========================= */
  readonly Menu = Menu;
  readonly Search = Search;
  readonly Eye = Eye;
  readonly Pencil = Pencil;
  readonly Check = Check;

  /* =========================
     UI STATE
  ========================= */
  readonly sidebarOpen = signal(false);
  readonly searchQuery = signal('');
  readonly statusFilter = signal('');
  readonly reportFilter = signal('');

  /* =========================
     MODALES
  ========================= */
  readonly isDetailModalOpen = signal(false);
  readonly isEditModalOpen = signal(false);
  readonly isReactivateModalOpen = signal(false);

  /* =========================
     USUARIO SELECCIONADO
  ========================= */
  readonly selectedUser = signal<AdminUser | null>(null);

  /* =========================
     FORM EDITAR ESTADO
  ========================= */
  readonly newStatus = signal<UserStatus>('ACTIVO');
  readonly blockReason = signal('');

  /* =========================
     DATA
  ========================= */
  readonly users = signal<AdminUser[]>(this.loadUsers());

  /* =========================
     COMPUTED: OVERLAY
  ========================= */
  readonly anyModalOpen = computed(() => {
    return (
      this.isDetailModalOpen() ||
      this.isEditModalOpen() ||
      this.isReactivateModalOpen()
    );
  });

  /* =========================
     COMPUTED: FILTRADO
  ========================= */
  readonly filteredUsers = computed(() => {
    let result = [...this.users()];

    const query = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();
    const reports = this.reportFilter();

    if (query) {
      result = result.filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
      );
    }

    if (status) {
      result = result.filter((user) => user.status === status);
    }

    if (reports === 'CON') {
      result = result.filter((user) => user.reportCount >= 1);
    }

    if (reports === 'CRITICO') {
      result = result.filter((user) => user.reportCount >= 3);
    }

    result.sort(
      (a, b) => this.parseDateToTime(b.createdAt) - this.parseDateToTime(a.createdAt)
    );

    return result;
  });

  /* =========================
     PERSISTENCIA BASE
  ========================= */
  private loadUsers(): AdminUser[] {
    const storedUsers = localStorage.getItem(this.USERS_KEY);

    if (!storedUsers) {
      return [];
    }

    try {
      const users = JSON.parse(storedUsers) as AdminUser[];
      return users.map((user) => this.normalizeUserForView(user));
    } catch {
      localStorage.removeItem(this.USERS_KEY);
      return [];
    }
  }

  private persistUsers(users: AdminUser[]): void {
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    this.users.set(users.map((user) => this.normalizeUserForView(user)));
  }

  private loadAuthUsers(): AuthUser[] {
    try {
      const raw = localStorage.getItem(this.AUTH_USERS_KEY);
      return raw ? (JSON.parse(raw) as AuthUser[]) : [];
    } catch {
      return [];
    }
  }

  private persistAuthUsers(users: AuthUser[]): void {
    localStorage.setItem(this.AUTH_USERS_KEY, JSON.stringify(users));
  }

  private normalizeUserForView(user: AdminUser): AdminUser {
    return {
      ...user,
      avatarUrl: user.avatarUrl ?? '',
      reportCount: user.reportCount ?? 0,
      createdAt: user.createdAt,
      blockedAt: user.blockedAt,
    };
  }

  /* =========================
     HELPERS
  ========================= */
  private getTodayFormatted(): string {
    return new Date().toISOString();
  }

  formatDateForView(value: string | null): string {
    if (!value) return '';

    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();

      return `${day}/${month}/${year}`;
    }

    const parts = value.split('/');

    if (parts.length >= 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2].slice(0, 4);

      return `${day}/${month}/${year}`;
    }

    return value;
  }

  private parseDateToTime(value: string): number {
    if (!value) return 0;

    const isoDate = new Date(value);
    if (!Number.isNaN(isoDate.getTime())) {
      return isoDate.getTime();
    }

    const parts = value.split('/').map(Number);
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return new Date(year, month - 1, day).getTime();
    }

    return 0;
  }

  private resetEditForm(): void {
    this.newStatus.set('ACTIVO');
    this.blockReason.set('');
  }

  private mapAdminStatusToAuthStatus(status: UserStatus): AuthUser['status'] {
    if (status === 'BLOQUEADO') return 'BLOCKED';
    if (status === 'INACTIVO') return 'INACTIVE';
    return 'ACTIVE';
  }

  private syncStatusToAuthUsers(
    userId: string,
    status: UserStatus,
    reason: string | null,
    blockedAt: string | null
  ): void {
    const authUsers = this.loadAuthUsers();

    const updatedAuthUsers = authUsers.map((user) => {
      if (user.id !== userId) return user;

      return {
        ...user,
        status: this.mapAdminStatusToAuthStatus(status),
        blockReason: status === 'BLOQUEADO' ? reason : null,
        blockedAt: status === 'BLOQUEADO' ? blockedAt : null,
      };
    });

    this.persistAuthUsers(updatedAuthUsers);
  }

  /* =========================
     MODAL DETALLE
  ========================= */
  openDetailModal(user: AdminUser): void {
    this.selectedUser.set(user);
    this.isDetailModalOpen.set(true);
  }

  /* =========================
     MODAL CAMBIAR ESTADO
  ========================= */
  openEditModal(user: AdminUser): void {
    this.selectedUser.set(user);
    this.newStatus.set(user.status);
    this.blockReason.set(user.blockReason ?? '');
    this.isEditModalOpen.set(true);
  }

  updateUserStatus(): void {
    const current = this.selectedUser();
    if (!current) return;

    const nextStatus = this.newStatus();
    const reason = this.blockReason().trim();
    const blockedAt = nextStatus === 'BLOQUEADO' ? this.getTodayFormatted() : null;

    if (nextStatus === 'BLOQUEADO' && !reason) {
      return;
    }

    const updatedUsers = this.users().map((user) => {
      if (user.id !== current.id) return user;

      return {
        ...user,
        status: nextStatus,
        blockReason: nextStatus === 'BLOQUEADO' ? reason : null,
        blockedAt,
      };
    });

    this.persistUsers(updatedUsers);
    this.syncStatusToAuthUsers(
      current.id,
      nextStatus,
      nextStatus === 'BLOQUEADO' ? reason : null,
      blockedAt
    );

    this.closeAllModals();
  }

  /* =========================
     MODAL REACTIVAR
  ========================= */
  openReactivateModal(user: AdminUser): void {
    this.selectedUser.set(user);
    this.isReactivateModalOpen.set(true);
  }

  reactivateUser(): void {
    const current = this.selectedUser();
    if (!current) return;

    const updatedUsers = this.users().map((user) => {
      if (user.id !== current.id) return user;

      return {
        ...user,
        status: 'ACTIVO' as UserStatus,
        blockReason: null,
        blockedAt: null,
      };
    });

    this.persistUsers(updatedUsers);
    this.syncStatusToAuthUsers(current.id, 'ACTIVO', null, null);

    this.closeAllModals();
  }

  /* =========================
     CIERRE GENERAL MODALES
  ========================= */
  closeAllModals(): void {
    this.isDetailModalOpen.set(false);
    this.isEditModalOpen.set(false);
    this.isReactivateModalOpen.set(false);
    this.selectedUser.set(null);
    this.resetEditForm();
  }
}