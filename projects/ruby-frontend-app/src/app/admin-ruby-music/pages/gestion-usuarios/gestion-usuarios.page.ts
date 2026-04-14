import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  Check,
  Eye,
  LucideAngularModule,
  Menu,
  Pencil,
  Search,
} from 'lucide-angular';

import { AdminSidebarComponent } from '../../components/admin-sidebar/admin-sidebar.component';
import {
  ChangeUserStatusRequest,
  UserResponse,
  UserStatus as SdkUserStatus,
  UsersApi,
} from 'lib-ruby-sdks/auth-service';

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
export class GestionUsuariosPage implements OnInit {
  /* =========================
     SERVICIOS
  ========================= */
  private readonly usersApi = inject(UsersApi);

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
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

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
  readonly users = signal<AdminUser[]>([]);

  /* =========================
     LIFECYCLE
  ========================= */
  ngOnInit(): void {
    this.reloadUsers();
  }

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
     CARGA / RECARGA
  ========================= */
  private reloadUsers(): void {
    this.loading.set(true);
    this.error.set(null);

    this.usersApi.listUsers().subscribe({
      next: (page) => {
        this.users.set(this.mapUsers(page.content ?? []));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al cargar los usuarios');
        this.loading.set(false);
      },
    });
  }

  /* =========================
     MAPPER SDK → LOCAL
  ========================= */
  private mapUsers(sdkUsers: UserResponse[]): AdminUser[] {
    return sdkUsers.map((u) => this.normalizeUserForView({
      id: u.id ?? '',
      name: u.displayName ?? u.email ?? '',
      email: u.email ?? '',
      avatarUrl: u.profilePhotoUrl ?? '',
      status: this.mapUserStatus(u.status),
      createdAt: u.createdAt ?? '',
      reportCount: 0,
      blockReason: u.blockReason ?? null,
      blockedAt: null,
    }));
  }

  private mapUserStatus(status?: string): UserStatus {
    switch (status) {
      case 'ACTIVE': return 'ACTIVO';
      case 'INACTIVE': return 'INACTIVO';
      case 'BLOCKED': return 'BLOQUEADO';
      default: return 'ACTIVO';
    }
  }

  private mapToSdkStatus(status: UserStatus): SdkUserStatus {
    if (status === 'BLOQUEADO') return 'BLOCKED';
    if (status === 'INACTIVO') return 'INACTIVE';
    return 'ACTIVE';
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

    if (nextStatus === 'BLOQUEADO' && !reason) return;

    const request: ChangeUserStatusRequest = {
      status: this.mapToSdkStatus(nextStatus),
      ...(nextStatus === 'BLOQUEADO' ? { blockReason: reason as ChangeUserStatusRequest['blockReason'] } : {}),
    };

    this.loading.set(true);
    this.error.set(null);

    this.usersApi.changeUserStatus(current.id, request).subscribe({
      next: () => {
        this.closeAllModals();
        this.reloadUsers();
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al cambiar el estado del usuario');
        this.loading.set(false);
      },
    });
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

    this.loading.set(true);
    this.error.set(null);

    this.usersApi.changeUserStatus(current.id, { status: 'ACTIVE' }).subscribe({
      next: () => {
        this.closeAllModals();
        this.reloadUsers();
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al reactivar el usuario');
        this.loading.set(false);
      },
    });
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
