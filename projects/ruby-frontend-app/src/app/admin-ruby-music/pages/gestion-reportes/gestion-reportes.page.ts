import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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
import { Observable, catchError, forkJoin, of, switchMap } from 'rxjs';

import { LucideAngularModule } from 'lucide-angular';
import { AdminSidebarComponent } from '../../components/admin-sidebar/admin-sidebar.component';
import { API_GATEWAY_URL } from 'lib-ruby-core';
import { formatDateTime } from '../../../core/utils/date-format';
import {
  ReportResponse,
  ReportTargetSummary,
  ReportTargetType,
  ReportsApi,
} from 'lib-ruby-sdks/social-service';
import {
  ChangeUserStatusRequest,
  UserResponse,
  UsersApi,
} from 'lib-ruby-sdks/auth-service';

/** Narrow projection returned by realtime-api-ms GET /comments/:id */
interface CommentAuthorLookup {
  user_id: string;
  username: string;
  profile_photo_url: string | null;
  content: string;
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
  /** Representative targetId (first merged). Kept for legacy usage. */
  targetId: string;
  /**
   * All backend target ids folded into this card (one per reported comment
   * for COMMENT rollups, or a single user id for USER rollups). Actions that
   * touch the backend (dismiss / block) must iterate this list so every
   * underlying PENDING report gets closed.
   */
  targetIds: string[];
  targetType: ReportTargetType;

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
  private readonly http = inject(HttpClient);
  private readonly gatewayUrl = inject(API_GATEWAY_URL);

  /** Public wrapper so the template can format ISO dates as `dd/MM/yyyy, HH:mm`. */
  readonly formatDateTime = formatDateTime;

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

    this.reportsApi.listGroupedReports().pipe(
      switchMap((groups) => this.enrichGroups(groups)),
    ).subscribe({
      next: (enriched) => {
        const rolledUp = this.rollupByReportedPerson(enriched);
        this.reports.set(
          rolledUp
            .filter((r) => r.totalReports > 0)
            .sort(
              (a, b) =>
                this.parseReportDate(b.lastReportAt) -
                this.parseReportDate(a.lastReportAt),
            ),
        );
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Error al cargar los reportes');
        this.loading.set(false);
      },
    });
  }

  /**
   * Enriches each grouped summary with data the backend's `/reports/grouped`
   * endpoint does not provide:
   *  - individual reports (for reason/history) via `getReportsByTarget`
   *  - reported user's name/avatar via `usersApi.getUserById` (USER targets only)
   * COMMENT targets currently show a generic label because there is no
   * frontend-accessible endpoint to resolve a commentId → author.
   */
  private enrichGroups(groups: ReportTargetSummary[]) {
    if (!groups.length) return of<Report[]>([]);
    return forkJoin(groups.map((g) => this.enrichGroup(g)));
  }

  private enrichGroup(group: ReportTargetSummary) {
    const targetId   = group.targetId ?? '';
    const targetType = group.targetType ?? ReportTargetType.USER;
    const isUser     = targetType === ReportTargetType.USER;
    const isComment  = targetType === ReportTargetType.COMMENT;

    const reports$ = this.reportsApi
      .getReportsByTarget(targetId)
      .pipe(catchError(() => of<ReportResponse[]>([])));

    const user$ = isUser
      ? this.usersApi
          .getUserById(targetId)
          .pipe(catchError(() => of<UserResponse | null>(null)))
      : of<UserResponse | null>(null);

    // For COMMENT targets we need the comment to know WHO authored it; then we
    // resolve the author against auth-service so name/avatar are the CURRENT
    // ones (profile updates are reflected immediately — the name/avatar stored
    // in Mongo at comment creation time may be stale).
    const comment$ = isComment
      ? this.http
          .get<CommentAuthorLookup>(
            `${this.gatewayUrl}/api/v1/realtime/comments/${targetId}`,
          )
          .pipe(catchError(() => of<CommentAuthorLookup | null>(null)))
      : of<CommentAuthorLookup | null>(null);

    return forkJoin([reports$, user$, comment$]).pipe(
      switchMap(([reports, user, comment]) => {
        const authorLookup$ = isComment && comment?.user_id
          ? this.usersApi
              .getUserById(comment.user_id)
              .pipe(catchError(() => of<UserResponse | null>(null)))
          : of<UserResponse | null>(null);

        return authorLookup$.pipe(
          switchMap((commentAuthor) =>
            of(this.buildReport(
              group, targetId, targetType, reports, user, comment, commentAuthor,
            )),
          ),
        );
      }),
    );
  }

  private buildReport(
    group: ReportTargetSummary,
    targetId: string,
    targetType: ReportTargetType,
    reports: ReportResponse[],
    user: UserResponse | null,
    comment: CommentAuthorLookup | null,
    commentAuthor: UserResponse | null,
  ): Report {
    const { reason, count } = this.computeMostFrequentReason(reports);
    const history = this.buildHistory(reports);

    let reportedUserId        = targetId;
    let reportedUserName      = '';
    let reportedUserAvatarUrl = '';

    switch (targetType) {
      case ReportTargetType.USER:
        reportedUserName      = user?.displayName ?? targetId;
        reportedUserAvatarUrl = user?.profilePhotoUrl ?? '';
        break;
      case ReportTargetType.COMMENT:
        if (comment) {
          // Swap targetId for the comment's AUTHOR so "Bloquear usuario" actually
          // targets the person, not the comment id.
          reportedUserId = comment.user_id;
          // Prefer CURRENT author identity (auth-service) over the username/photo
          // persisted with the comment in Mongo, so profile updates show up.
          reportedUserName      = commentAuthor?.displayName ?? comment.username;
          reportedUserAvatarUrl = commentAuthor?.profilePhotoUrl ?? comment.profile_photo_url ?? '';
        } else {
          reportedUserName = 'Comentario reportado';
        }
        break;
      case ReportTargetType.SONG:
        reportedUserName = 'Canción reportada';
        break;
    }

    return {
      targetId,
      targetIds: [targetId],
      targetType,
      reportedUserId,
      reportedUserName,
      reportedUserAvatarUrl,
      totalReports: group.reportCount ?? reports.length,
      lastReportAt: group.latestReportAt ?? '',
      mostFrequentReason: reason,
      mostFrequentReasonCount: count,
      reportHistory: history,
    };
  }

  /**
   * Client-side rollup: collapse multiple cards that point to the SAME person
   * of the SAME target type (e.g. five different reported comments from the
   * same user) into a single card. The backend already groups per target; this
   * groups per (reportedUserId, targetType) on top of that so the admin doesn't
   * see 5 visually-identical cards for the same person.
   *
   * USER rollups are already 1-to-1 at the backend level, so this is a no-op
   * for them. SONG rollups stay 1-to-1 too.
   */
  private rollupByReportedPerson(list: Report[]): Report[] {
    const merged = new Map<string, Report>();

    for (const r of list) {
      const key = `${r.targetType}::${r.reportedUserId}`;
      const current = merged.get(key);

      if (!current) {
        merged.set(key, { ...r, targetIds: [...r.targetIds] });
        continue;
      }

      current.targetIds.push(...r.targetIds);
      current.totalReports += r.totalReports;

      current.reportHistory = [...current.reportHistory, ...r.reportHistory].sort(
        (a, b) =>
          this.parseReportDate(b.createdAt) - this.parseReportDate(a.createdAt),
      );

      if (
        this.parseReportDate(r.lastReportAt) >
        this.parseReportDate(current.lastReportAt)
      ) {
        current.lastReportAt = r.lastReportAt;
      }

      // Recompute the most frequent reason over the merged history.
      const tally = new Map<string, number>();
      for (const h of current.reportHistory) {
        const reason = h.reason || 'Sin motivo';
        tally.set(reason, (tally.get(reason) ?? 0) + 1);
      }
      let topReason = 'Sin motivo';
      let topCount = 0;
      for (const [reason, count] of tally) {
        if (count > topCount) {
          topReason = reason;
          topCount = count;
        }
      }
      current.mostFrequentReason = topReason;
      current.mostFrequentReasonCount = topCount;
    }

    return Array.from(merged.values());
  }

  private computeMostFrequentReason(
    reports: ReportResponse[],
  ): { reason: string; count: number } {
    if (!reports.length) return { reason: 'Sin motivo', count: 0 };

    const tally = new Map<string, number>();
    for (const r of reports) {
      const key = (r.reason ?? '').trim() || 'Sin motivo';
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }

    let winner = 'Sin motivo';
    let winnerCount = 0;
    for (const [reason, count] of tally) {
      if (count > winnerCount) {
        winner = reason;
        winnerCount = count;
      }
    }
    return { reason: winner, count: winnerCount };
  }

  private buildHistory(reports: ReportResponse[]): ReportHistory[] {
    return reports
      .map((r) => ({
        id: r.id ?? '',
        reason: (r.reason ?? '').trim() || 'Sin motivo',
        createdAt: r.createdAt ?? '',
      }))
      .sort(
        (a, b) =>
          this.parseReportDate(b.createdAt) - this.parseReportDate(a.createdAt),
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

  /**
   * Closes every PENDING report for each folded target id in parallel. Used by
   * both "Descartar" and "Bloquear usuario". Falls back to a single no-op
   * observable if the list somehow arrives empty so the pipe never stalls.
   *
   * Return type is unified to Observable<unknown> so both branches (empty
   * shortcut vs forkJoin of dismisses) produce a single callable shape for
   * subscribe / switchMap in the callers.
   */
  private dismissAllTargets(targetIds: string[]): Observable<unknown> {
    const unique = Array.from(new Set(targetIds.filter((id) => !!id)));
    if (!unique.length) return of(undefined);
    return forkJoin(
      unique.map((id) => this.reportsApi.dismissReportsByTarget(id)),
    );
  }

  /**
   * Fallback when an avatar URL 404s or is otherwise unreachable (e.g. the
   * stored photo has been deleted). Replaces the broken src with the local
   * placeholder so we never show a broken image icon.
   */
  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    const placeholder = '/assets/icons/avatar-placeholder.png';
    if (img.src.endsWith(placeholder)) return; // prevent infinite loop
    img.src = placeholder;
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

    // Block uses reportedUserId (the actual person — for COMMENT rollups this
    // is the comment author, not any individual commentId). Dismiss iterates
    // ALL targetIds folded into this card so every underlying PENDING report
    // (e.g. every reported comment by this user) gets closed in one action.
    this.usersApi.changeUserStatus(report.reportedUserId, request).pipe(
      switchMap(() => this.dismissAllTargets(report.targetIds)),
    ).subscribe({
      next: () => {
        this.closeAllModals();
        this.loadReports();
      },
      error: (err: { message?: string }) => {
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

    this.dismissAllTargets(report.targetIds).subscribe({
      next: () => {
        this.closeAllModals();
        this.loadReports();
      },
      error: (err: { message?: string }) => {
        this.error.set(err?.message ?? 'Error al descartar los reportes');
        this.loading.set(false);
      },
    });
  }
}
