import { Component, computed, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import {
  LucideAngularModule,
  Menu, Eye, Pencil, X, ChevronDown, Users, Check, ShieldAlert,
} from 'lucide-angular';
import { AdminSidebarComponent } from '../../components/admin-sidebar/admin-sidebar.component';

export type UserStatus   = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
export type StatusFilter  = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
export type ReportsFilter = 'ALL' | 'WITH_REPORTS' | 'CRITICAL';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarColor: string;
  status: UserStatus;
  reportCount: number;
  blockReason: string;
  registeredAt: string;
}

const MOCK_USERS: AdminUser[] = [
  { id: '1', name: 'Mateo Ignacio',    email: 'mateo.ignacio@example.com',    initials: 'MI', avatarColor: '#7c3aed', status: 'ACTIVE',   reportCount: 0, blockReason: '', registeredAt: '10/01/2026' },
  { id: '2', name: 'Luis García',      email: 'luisgarcia@example.com',       initials: 'LG', avatarColor: '#0891b2', status: 'ACTIVE',   reportCount: 1, blockReason: '', registeredAt: '15/01/2026' },
  { id: '3', name: 'Diego Martínez',   email: 'diegomar12tinez@example.com',  initials: 'DM', avatarColor: '#374151', status: 'BLOCKED',  reportCount: 5, blockReason: 'Acoso o bullying', registeredAt: '02/03/2026' },
  { id: '4', name: 'María Fernández',  email: 'marieler1234@example.com',     initials: 'MF', avatarColor: '#be185d', status: 'ACTIVE',   reportCount: 0, blockReason: '', registeredAt: '20/02/2026' },
  { id: '5', name: 'Mateo Acosta',     email: 'macosta@example.com',          initials: 'MA', avatarColor: '#15803d', status: 'ACTIVE',   reportCount: 2, blockReason: '', registeredAt: '28/02/2026' },
  { id: '6', name: 'Valentina Cruz',   email: 'vcruz@example.com',            initials: 'VC', avatarColor: '#b45309', status: 'INACTIVE', reportCount: 0, blockReason: '', registeredAt: '05/03/2026' },
  { id: '7', name: 'Andrés Romero',    email: 'aromero@example.com',          initials: 'AR', avatarColor: '#c2410c', status: 'BLOCKED',  reportCount: 4, blockReason: 'Incita la violencia', registeredAt: '12/02/2026' },
  { id: '8', name: 'Sofía Herrera',    email: 'sofiaH@example.com',           initials: 'SH', avatarColor: '#6d28d9', status: 'ACTIVE',   reportCount: 3, blockReason: '', registeredAt: '01/03/2026' },
];

export const BLOCK_REASONS = [
  'Acoso o bullying',
  'Incita la violencia',
  'Contenido inapropiado',
  'Spam a la plataforma',
  'Lenguaje ofensivo',
  'Suplantación de identidad',
];

@Component({
  selector:    'rm-gestion-usuarios-page',
  standalone:  true,
  imports:     [LucideAngularModule, AdminSidebarComponent, NgClass],
  templateUrl: './gestion-usuarios.page.html',
  styleUrl:    './gestion-usuarios.page.scss',
})
export class GestionUsuariosPage {

  /* ── Icons ─────────────────────────────────────────────────────────── */
  readonly Menu       = Menu;
  readonly Eye        = Eye;
  readonly Pencil     = Pencil;
  readonly X          = X;
  readonly ChevronDown = ChevronDown;
  readonly Users      = Users;
  readonly Check      = Check;
  readonly ShieldAlert = ShieldAlert;

  /* ── Sidebar ────────────────────────────────────────────────────────── */
  readonly sidebarOpen = signal(false);

  /* ── Data ───────────────────────────────────────────────────────────── */
  private readonly _users = signal<AdminUser[]>(structuredClone(MOCK_USERS));
  readonly blockReasons   = BLOCK_REASONS;

  /* ── Filters ────────────────────────────────────────────────────────── */
  readonly searchQuery   = signal('');
  readonly statusFilter  = signal<StatusFilter>('ALL');
  readonly reportsFilter = signal<ReportsFilter>('ALL');

  /* Only one filter dropdown open at a time */
  readonly openFilter = signal<'status' | 'reports' | null>(null);

  readonly filteredUsers = computed(() => {
    const q   = this.searchQuery().toLowerCase().trim();
    const sf  = this.statusFilter();
    const rf  = this.reportsFilter();

    return this._users().filter(u => {
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      if (sf !== 'ALL' && u.status !== sf) return false;
      if (rf === 'WITH_REPORTS' && u.reportCount === 0) return false;
      if (rf === 'CRITICAL'     && u.reportCount < 3)  return false;
      return true;
    });
  });

  /* ── Modal: View user ───────────────────────────────────────────────── */
  readonly viewingUser = signal<AdminUser | null>(null);

  openViewModal(user: AdminUser): void { this.viewingUser.set(user); }
  closeViewModal(): void               { this.viewingUser.set(null); }

  /* ── Modal: Edit status ─────────────────────────────────────────────── */
  readonly editingUser           = signal<AdminUser | null>(null);
  readonly newStatus             = signal<UserStatus>('ACTIVE');
  readonly newStatusDropOpen     = signal(false);
  readonly blockReason           = signal('');
  readonly blockReasonDropOpen   = signal(false);

  openEditModal(user: AdminUser): void {
    this.editingUser.set(user);
    this.newStatus.set(user.status);
    this.blockReason.set(user.blockReason);
    this.newStatusDropOpen.set(false);
    this.blockReasonDropOpen.set(false);
  }

  closeEditModal(): void {
    this.editingUser.set(null);
    this.newStatusDropOpen.set(false);
    this.blockReasonDropOpen.set(false);
  }

  selectNewStatus(s: UserStatus): void {
    this.newStatus.set(s);
    this.newStatusDropOpen.set(false);
    if (s !== 'BLOCKED') this.blockReason.set('');
  }

  selectBlockReason(r: string): void {
    this.blockReason.set(r);
    this.blockReasonDropOpen.set(false);
  }

  confirmStatusChange(): void {
    const user  = this.editingUser();
    const next  = this.newStatus();
    if (!user) return;

    /* Blocked → needs a reason */
    if (next === 'BLOCKED' && !this.blockReason()) return;

    /* Reactivating a blocked/inactive user */
    if (next === 'ACTIVE' && user.status !== 'ACTIVE') {
      this.closeEditModal();
      this.reactivatingUser.set(user);
      this._pendingReactivate = true;
      return;
    }

    this.applyStatusChange(user, next, this.blockReason());
    this.closeEditModal();
  }

  /* ── Modal: Reactivate confirm ──────────────────────────────────────── */
  readonly reactivatingUser  = signal<AdminUser | null>(null);
  private  _pendingReactivate = false;

  confirmReactivate(): void {
    const user = this.reactivatingUser();
    if (!user) return;
    this.applyStatusChange(user, 'ACTIVE', '');
    this.reactivatingUser.set(null);
    this._pendingReactivate = false;
  }

  cancelReactivate(): void {
    this.reactivatingUser.set(null);
    this._pendingReactivate = false;
  }

  /* ── Helpers ────────────────────────────────────────────────────────── */
  private applyStatusChange(user: AdminUser, status: UserStatus, reason: string): void {
    this._users.update(list =>
      list.map(u =>
        u.id === user.id ? { ...u, status, blockReason: reason } : u
      )
    );
  }

  reportBadgeClass(count: number): string {
    if (count === 0) return 'badge--none';
    if (count === 1) return 'badge--yellow';
    if (count === 2) return 'badge--orange';
    return 'badge--red';
  }

  statusLabel(s: UserStatus): string {
    return s === 'ACTIVE' ? 'Activo' : s === 'INACTIVE' ? 'Inactivo' : 'Bloqueado';
  }

  statusFilterLabel(): string {
    const map: Record<StatusFilter, string> = {
      ALL:      'Todos los estados',
      ACTIVE:   'Activos',
      INACTIVE: 'Inactivos',
      BLOCKED:  'Bloqueados',
    };
    return map[this.statusFilter()];
  }

  reportsFilterLabel(): string {
    const map: Record<ReportsFilter, string> = {
      ALL:          'Todos los reportes',
      WITH_REPORTS: 'Con reportes',
      CRITICAL:     'Críticos (3+)',
    };
    return map[this.reportsFilter()];
  }

  setStatusFilter(f: StatusFilter): void {
    this.statusFilter.set(f);
    this.openFilter.set(null);
  }

  setReportsFilter(f: ReportsFilter): void {
    this.reportsFilter.set(f);
    this.openFilter.set(null);
  }

  toggleFilter(which: 'status' | 'reports'): void {
    this.openFilter.update(cur => (cur === which ? null : which));
  }

  closeFilters(): void { this.openFilter.set(null); }

  anyModalOpen(): boolean {
    return !!this.viewingUser() || !!this.editingUser() || !!this.reactivatingUser();
  }
}
