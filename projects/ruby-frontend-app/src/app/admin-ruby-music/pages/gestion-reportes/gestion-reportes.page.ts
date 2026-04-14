import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
import { switchMap } from 'rxjs';

import { LucideAngularModule } from 'lucide-angular';
import { AdminSidebarComponent } from '../../components/admin-sidebar/admin-sidebar.component';
import { ReportTargetSummary, ReportsApi } from 'lib-ruby-sdks/social-service';
import {
  ChangeUserStatusRequest,
  UsersApi,
} from 'lib-ruby-sdks/auth-service';

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
export class GestionReportesPage implements OnInit {
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
     SERVICIOS
  ========================== */
  private readonly reportsApi = inject(ReportsApi);
  private readonly usersApi = inject(UsersApi);

  /* =========================
     STATE
  ========================== */
  readonly sidebarOpen = signal(false);
  readonly searchQuery = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly isDetailModalOpen = signal(false);
  readonly isBlockModalOpen = signal(false);
  readonly isDiscardModalOpen = signal(false);

  readonly selectedReport = signal<Report | null>(null);
  readonly selectedBlockReason = signal('');

  /* =========================
     DATA
  ========================== */
  readonly reports = signal<Report[]>([]);

  /* =========================
     LIFECYCLE
  ========================== */
  ngOnInit(): void {
    this.loadReports();
  }

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
     CARGA / RECARGA
  ========================== */
  private loadReports(): void {
    this.loading.set(true);
    this.error.set(null);

    this.reportsApi.listGroupedReports().subscribe({
      next: (sdkReports) => {
        this.reports.set(this.mapGroupedReports(sdkReports));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al cargar los reportes');
        this.loading.set(false);
      },
    });
  }

  /* =========================
     MAPPER SDK → LOCAL
  ========================== */
  private mapGroupedReports(sdkReports: ReportTargetSummary[]): Report[] {
    return sdkReports
      .map((r) => ({
        reportedUserId: r.targetId ?? '',
        reportedUserName: r.targetId ?? '',
        reportedUserAvatarUrl: '',
        totalReports: r.reportCount ?? 0,
        lastReportAt: r.latestReportAt ?? '',
        mostFrequentReason: r.targetType ?? '',
        mostFrequentReasonCount: r.reportCount ?? 1,
        reportHistory: [] as ReportHistory[],
      }))
      .filter((r) => r.totalReports > 0)
      .sort(
        (a, b) =>
          this.parseReportDate(b.lastReportAt) - this.parseReportDate(a.lastReportAt)
      );
  }

  /* =========================
     HELPERS
  ========================== */
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

    const request: ChangeUserStatusRequest = {
      status: 'BLOCKED',
      blockReason: reason as ChangeUserStatusRequest['blockReason'],
    };

    this.loading.set(true);
    this.error.set(null);

    this.usersApi.changeUserStatus(report.reportedUserId, request).pipe(
      switchMap(() => this.reportsApi.dismissReportsByTarget(report.reportedUserId))
    ).subscribe({
      next: () => {
        this.closeAllModals();
        this.loadReports();
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al bloquear el usuario');
        this.loading.set(false);
      },
    });
  }

  confirmDiscardReport(): void {
    const report = this.selectedReport();
    if (!report) return;

    this.loading.set(true);
    this.error.set(null);

    this.reportsApi.dismissReportsByTarget(report.reportedUserId).subscribe({
      next: () => {
        this.closeAllModals();
        this.loadReports();
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al descartar los reportes');
        this.loading.set(false);
      },
    });
  }
}
