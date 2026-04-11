import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import {
  Ban,
  CalendarDays,
  Eye,
  FileText,
  Menu,
  Search,
  UserRound,
  X,
} from 'lucide-angular';

import { LucideAngularModule } from 'lucide-angular';
import { AdminSidebarComponent } from '../../components/admin-sidebar/admin-sidebar.component';

/* =========================
   INTERFACES BASE
========================== */
type UserStatus = 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';
type AuthUserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

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
  status: AuthUserStatus;
  blockReason: string | null;
  blockedAt: string | null;
  onboardingCompleted: boolean;
  selectedStationIds: string[];
  createdAt: string;
}

interface ReportItem {
  id: string;
  reportedUserId: string;
  reason: string;
  createdAt: string;
}

/* =========================
   INTERFACES UI
========================== */
interface ReportHistory {
  id: string;
  reason: string;
  createdAt: string;
}

interface Report {
  reportedUserId: string;
  reportedUserName: string;
  reportedUserAvatarUrl: string;

  totalReports: number;
  lastReportAt: string;

  mostFrequentReason: string;
  mostFrequentReasonCount: number;

  reportHistory: ReportHistory[];
}

/* =========================
   COMPONENTE
========================== */
@Component({
  selector: 'app-gestion-reportes-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, AdminSidebarComponent],
  templateUrl: './gestion-reportes.page.html',
  styleUrl: './gestion-reportes.page.scss',
})
export class GestionReportesPage {
  /* =========================
     ICONOS
  ========================== */
  readonly Menu = Menu;
  readonly Search = Search;
  readonly Eye = Eye;
  readonly Ban = Ban;
  readonly X = X;
  readonly FileText = FileText;
  readonly CalendarDays = CalendarDays;
  readonly UserRound = UserRound;

  /* =========================
     STORAGE KEYS
  ========================== */
  private readonly REPORTS_KEY = 'ruby_reports';
  private readonly USERS_KEY = 'ruby_users';
  private readonly AUTH_USERS_KEY = 'ruby_auth_users';

  /* =========================
     STATE
  ========================== */
  readonly sidebarOpen = signal(false);
  readonly searchQuery = signal('');

  readonly isDetailModalOpen = signal(false);
  readonly isBlockModalOpen = signal(false);
  readonly isDiscardModalOpen = signal(false);

  readonly selectedReport = signal<Report | null>(null);
  readonly selectedBlockReason = signal('');

  /* =========================
     DATA
  ========================== */
  readonly reports = signal<Report[]>(this.loadReports());

  /* =========================
     COMPUTED
  ========================== */
  readonly filteredReports = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();

    if (!query) return this.reports();

    return this.reports().filter((report) =>
      report.reportedUserName.toLowerCase().includes(query)
    );
  });

  readonly anyModalOpen = computed(() => {
    return (
      this.isDetailModalOpen() ||
      this.isBlockModalOpen() ||
      this.isDiscardModalOpen()
    );
  });

  /* =========================
     STORAGE / BUILDERS
  ========================== */
  private loadReports(): Report[] {
    const authUsersRaw = localStorage.getItem(this.AUTH_USERS_KEY);
    const reportsRaw = localStorage.getItem(this.REPORTS_KEY);

    const authUsers: AuthUser[] = authUsersRaw ? JSON.parse(authUsersRaw) : [];
    const reportItems: ReportItem[] = reportsRaw ? JSON.parse(reportsRaw) : [];

    return this.buildReportsFromStorage(authUsers, reportItems);
  }

  private saveReportItems(reportItems: ReportItem[]): void {
    localStorage.setItem(this.REPORTS_KEY, JSON.stringify(reportItems));
  }

  private loadAdminUsers(): AdminUser[] {
    const raw = localStorage.getItem(this.USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  private saveAdminUsers(users: AdminUser[]): void {
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
  }

  private loadAuthUsers(): AuthUser[] {
    const raw = localStorage.getItem(this.AUTH_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  private saveAuthUsers(users: AuthUser[]): void {
    localStorage.setItem(this.AUTH_USERS_KEY, JSON.stringify(users));
  }

  private buildReportsFromStorage(
    authUsers: AuthUser[],
    reportItems: ReportItem[]
  ): Report[] {
    const validUsers = authUsers.filter(
      (user) => user.role === 'USER' && user.status !== 'BLOCKED'
    );

    const grouped = validUsers
      .map((user) => {
        const userReports = reportItems
          .filter((report) => report.reportedUserId === user.id)
          .sort(
            (a, b) =>
              this.parseReportDate(b.createdAt) - this.parseReportDate(a.createdAt)
          );

        if (userReports.length === 0) {
          return null;
        }

        const reasonFrequency = new Map<string, number>();

        for (const report of userReports) {
          reasonFrequency.set(
            report.reason,
            (reasonFrequency.get(report.reason) ?? 0) + 1
          );
        }

        let mostFrequentReason = '';
        let mostFrequentReasonCount = 0;

        for (const [reason, count] of reasonFrequency.entries()) {
          if (count > mostFrequentReasonCount) {
            mostFrequentReason = reason;
            mostFrequentReasonCount = count;
          }
        }

        return {
          reportedUserId: user.id,
          reportedUserName: user.name,
          reportedUserAvatarUrl: user.avatarUrl ?? '',
          totalReports: userReports.length,
          lastReportAt: userReports[0].createdAt,
          mostFrequentReason,
          mostFrequentReasonCount,
          reportHistory: userReports.map((report) => ({
            id: report.id,
            reason: report.reason,
            createdAt: report.createdAt,
          })),
        } satisfies Report;
      })
      .filter((report): report is Report => report !== null);

    return grouped.sort(
      (a, b) => this.parseReportDate(b.lastReportAt) - this.parseReportDate(a.lastReportAt)
    );
  }

  private parseReportDate(value: string): number {
    if (!value) return 0;

    const isoDate = new Date(value);
    if (!Number.isNaN(isoDate.getTime())) {
      return isoDate.getTime();
    }

    const [datePart, timePart] = value.split(',').map((part) => part.trim());

    if (!datePart) return 0;

    const [day, month, year] = datePart.split('/').map(Number);

    if (!timePart) {
      return new Date(year, month - 1, day).getTime();
    }

    const [hours, minutes] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes).getTime();
  }

  private syncAdminUsersReportCount(reportItems: ReportItem[]): void {
    const users = this.loadAdminUsers();

    const updatedUsers = users.map((user) => {
      const reportCount = reportItems.filter(
        (report) => report.reportedUserId === user.id
      ).length;

      return {
        ...user,
        reportCount,
      };
    });

    this.saveAdminUsers(updatedUsers);
  }

  private syncBlockedUserToAdmin(
    userId: string,
    reason: string,
    blockedAt: string
  ): void {
    const users = this.loadAdminUsers();

    const updatedUsers = users.map((user) => {
      if (user.id !== userId) return user;

      return {
        ...user,
        status: 'BLOQUEADO' as UserStatus,
        blockReason: reason,
        blockedAt,
        reportCount: 0,
      };
    });

    this.saveAdminUsers(updatedUsers);
  }

  private reloadReports(): void {
    this.reports.set(this.loadReports());
  }

  /* =========================
     MODALES
  ========================== */
  openDetailModal(report: Report): void {
    this.selectedReport.set(report);
    this.isDetailModalOpen.set(true);
  }

  openBlockModal(report: Report): void {
    this.selectedReport.set(report);
    this.selectedBlockReason.set('');
    this.isBlockModalOpen.set(true);
  }

  openDiscardModal(report: Report): void {
    this.selectedReport.set(report);
    this.isDiscardModalOpen.set(true);
  }

  closeDetailModal(): void {
    this.isDetailModalOpen.set(false);
  }

  closeBlockModal(): void {
    this.isBlockModalOpen.set(false);
  }

  closeDiscardModal(): void {
    this.isDiscardModalOpen.set(false);
  }

  closeAllModals(): void {
    this.isDetailModalOpen.set(false);
    this.isBlockModalOpen.set(false);
    this.isDiscardModalOpen.set(false);
    this.selectedReport.set(null);
    this.selectedBlockReason.set('');
  }

  /* =========================
     ACCIONES
  ========================== */
  confirmBlockUser(): void {
    const report = this.selectedReport();
    const reason = this.selectedBlockReason().trim();

    if (!report || !reason) return;

    const authUsers = this.loadAuthUsers();
    const reportItems = this.loadReportItems();

    const blockedAt = this.getTodayFormatted();

    // 1. Bloquear en auth_users
    const updatedAuthUsers = authUsers.map((user) => {
      if (user.id !== report.reportedUserId) return user;

      return {
        ...user,
        status: 'BLOCKED' as AuthUserStatus,
        blockReason: reason,
        blockedAt,
      };
    });

    // 2. Eliminar todos los reportes de ese usuario
    const updatedReportItems = reportItems.filter(
      (item) => item.reportedUserId !== report.reportedUserId
    );

    this.saveAuthUsers(updatedAuthUsers);
    this.saveReportItems(updatedReportItems);

    // 3. Sincronizar admin
    this.syncBlockedUserToAdmin(report.reportedUserId, reason, blockedAt);
    this.syncAdminUsersReportCount(updatedReportItems);

    // 4. Recargar UI
    this.reloadReports();
    this.closeAllModals();
  }

  confirmDiscardReport(): void {
    const report = this.selectedReport();
    if (!report) return;

    const reportItems = this.loadReportItems();

    // Descarta todos los reportes agrupados del usuario en esta tabla
    const updatedReportItems = reportItems.filter(
      (item) => item.reportedUserId !== report.reportedUserId
    );

    this.saveReportItems(updatedReportItems);
    this.syncAdminUsersReportCount(updatedReportItems);
    this.reloadReports();
    this.closeAllModals();
  }

  /* =========================
     HELPERS
  ========================== */
  private loadReportItems(): ReportItem[] {
    const raw = localStorage.getItem(this.REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  private getTodayFormatted(): string {
    const date = new Date();

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year}, ${hours}:${minutes}`;
  }
}