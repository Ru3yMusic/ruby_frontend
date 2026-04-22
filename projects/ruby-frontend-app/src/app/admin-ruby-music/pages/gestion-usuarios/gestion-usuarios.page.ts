import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Check,
  Eye,
  LucideAngularModule,
  Menu,
  Search,
} from 'lucide-angular';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { AdminSidebarComponent } from '../../components/admin-sidebar/admin-sidebar.component';
import { API_GATEWAY_URL, BulkPresenceResult, RealtimePort } from 'lib-ruby-core';
import {
  UserResponse,
  UsersApi,
} from 'lib-ruby-sdks/auth-service';
import {
  ReportTargetSummary,
  ReportTargetType,
  ReportsApi,
} from 'lib-ruby-sdks/social-service';
import { translateBlockReason } from '../../../core/utils/block-reason-label';

/** Narrow projection returned by realtime-api-ms GET /comments/:id. */
interface CommentAuthorLookup {
  user_id: string;
  username: string;
  profile_photo_url: string | null;
  content: string;
}

/* =========================
   TIPOS / MODELOS
========================= */
type UserStatus = 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  /** True when auth-service flagged the account as BLOCKED (handled from Reportes). */
  isBlocked: boolean;
  /** Derived at render time: BLOQUEADO | ACTIVO | INACTIVO (presence-driven). */
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
  private readonly reportsApi = inject(ReportsApi);
  private readonly http = inject(HttpClient);
  private readonly gatewayUrl = inject(API_GATEWAY_URL);
  private readonly realtimePort = inject(RealtimePort);
  private readonly destroyRef = inject(DestroyRef);

  /** Public wrapper so the template can translate user.blockReason. */
  readonly translateBlockReason = translateBlockReason;

  /* =========================
     ICONOS
  ========================= */
  readonly Menu = Menu;
  readonly Search = Search;
  readonly Eye = Eye;
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
  readonly isReactivateModalOpen = signal(false);

  /* =========================
     USUARIO SELECCIONADO
  ========================= */
  readonly selectedUser = signal<AdminUser | null>(null);

  /* =========================
     DATA
  ========================= */
  private readonly _users = signal<AdminUser[]>([]);

  /**
   * Realtime presence set: userIds currently connected (has at least one live
   * socket in realtime-ws-ms). Drives the ACTIVO/INACTIVO badge the same way
   * Amigos does — fed by getBulkPresence() on load and patched live by
   * onUserPresenceChanged() broadcasts.
   */
  private readonly onlineUserIds = signal<ReadonlySet<string>>(new Set());

  /**
   * Users decorated with the presence-driven status. BLOQUEADO wins over
   * presence because a blocked account shouldn't render as "Activo" even if
   * it briefly keeps a socket open during the block transition.
   */
  readonly users = computed<AdminUser[]>(() => {
    const online = this.onlineUserIds();
    return this._users().map((u) => ({
      ...u,
      status: u.isBlocked
        ? ('BLOQUEADO' as const)
        : online.has(u.id)
          ? ('ACTIVO' as const)
          : ('INACTIVO' as const),
    }));
  });

  constructor() {
    // Patch the online set in place whenever ws-ms broadcasts a presence
    // change (user logs in / out / disconnects). Mirrors Amigos so both
    // screens stay in sync without reload.
    this.realtimePort
      .onUserPresenceChanged()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload) => {
        this.onlineUserIds.update((set) => {
          const next = new Set(set);
          if (payload.online) next.add(payload.userId);
          else next.delete(payload.userId);
          return next;
        });
      });
  }

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
    return this.isDetailModalOpen() || this.isReactivateModalOpen();
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

    // Load users + pending report groups in parallel; then resolve the author
    // of every COMMENT group (commentId → userId via realtime-api-ms) so a
    // user's count includes reports against any of their comments.
    forkJoin({
      usersPage: this.usersApi.listUsers(),
      groups: this.reportsApi
        .listGroupedReports()
        .pipe(catchError(() => of<ReportTargetSummary[]>([]))),
    })
      .pipe(
        switchMap(({ usersPage, groups }) =>
          this.buildReportCountMap(groups).pipe(
            map((counts) => ({ usersPage, counts })),
          ),
        ),
      )
      .subscribe({
        next: ({ usersPage, counts }) => {
          const mapped = this.mapUsers(usersPage.content ?? []).map((u) => ({
            ...u,
            reportCount: counts.get(u.id) ?? 0,
          }));
          this._users.set(mapped);
          this.loading.set(false);

          // Seed the online set with one REST call (same endpoint Amigos uses).
          // After this, onUserPresenceChanged keeps it live.
          const ids = mapped.filter((u) => !u.isBlocked).map((u) => u.id);
          if (ids.length > 0) {
            this.realtimePort
              .getBulkPresence(ids)
              .pipe(catchError(() => of<BulkPresenceResult>({})))
              .subscribe((presence) => {
                const online = new Set<string>();
                for (const [uid, info] of Object.entries(presence)) {
                  if (info?.online) online.add(uid);
                }
                this.onlineUserIds.set(online);
              });
          } else {
            this.onlineUserIds.set(new Set());
          }
        },
        error: (err: { message?: string }) => {
          this.error.set(err?.message ?? 'Error al cargar los usuarios');
          this.loading.set(false);
        },
      });
  }

  /**
   * Returns a Map<userId, pendingReportCount> by walking every ReportTargetSummary:
   *   - USER groups: targetId is already the userId → add reportCount.
   *   - COMMENT groups: targetId is the commentId; resolve the author via
   *     GET /comments/:id and add to that author's total.
   *   - SONG groups: skipped (songs don't map to a user).
   */
  private buildReportCountMap(groups: ReportTargetSummary[]) {
    const counts = new Map<string, number>();

    const commentGroups = groups.filter(
      (g) => g.targetType === ReportTargetType.COMMENT && !!g.targetId,
    );

    for (const g of groups) {
      if (g.targetType === ReportTargetType.USER && g.targetId) {
        counts.set(g.targetId, (counts.get(g.targetId) ?? 0) + (g.reportCount ?? 0));
      }
    }

    if (!commentGroups.length) {
      return of(counts);
    }

    return forkJoin(
      commentGroups.map((g) =>
        this.http
          .get<CommentAuthorLookup>(
            `${this.gatewayUrl}/api/v1/realtime/comments/${g.targetId}`,
          )
          .pipe(
            map((comment) => ({ group: g, comment })),
            catchError(() => of({ group: g, comment: null as CommentAuthorLookup | null })),
          ),
      ),
    ).pipe(
      map((resolved) => {
        for (const { group, comment } of resolved) {
          if (!comment?.user_id) continue;
          counts.set(
            comment.user_id,
            (counts.get(comment.user_id) ?? 0) + (group.reportCount ?? 0),
          );
        }
        return counts;
      }),
    );
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
      isBlocked: u.status === 'BLOCKED',
      // Initial placeholder — the real value comes from the presence-driven
      // computed `users` signal (BLOQUEADO / ACTIVO / INACTIVO).
      status: u.status === 'BLOCKED' ? 'BLOQUEADO' : 'INACTIVO',
      createdAt: u.createdAt ?? '',
      reportCount: 0,
      blockReason: u.blockReason ?? null,
      blockedAt: null,
    }));
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

  /* =========================
     MODAL DETALLE
  ========================= */
  openDetailModal(user: AdminUser): void {
    this.selectedUser.set(user);
    this.isDetailModalOpen.set(true);
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
    this.isReactivateModalOpen.set(false);
    this.selectedUser.set(null);
  }
}
