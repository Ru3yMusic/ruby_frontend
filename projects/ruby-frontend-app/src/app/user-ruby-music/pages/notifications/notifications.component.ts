import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { API_GATEWAY_URL } from 'lib-ruby-core';
import {
  FriendRequestItem,
  NotificationsState,
  StationNotificationItem,
} from '../../state/notifications.state';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';

type NotificationsTab = 'ACTIVIDAD' | 'SOLICITUDES';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, ImgFallbackDirective],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
})
export class NotificationsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authState = inject(AuthState);
  private readonly notificationsState = inject(NotificationsState);
  private readonly http = inject(HttpClient);
  private readonly gatewayUrl = inject(API_GATEWAY_URL);

  readonly currentUser = this.authState.currentUser;

  readonly activeTab = signal<NotificationsTab>('ACTIVIDAD');

  readonly isDeleteModalOpen = signal(false);
  readonly selectedNotificationToDelete = signal<StationNotificationItem | null>(null);

  readonly toastMessage = signal('');
  readonly isToastVisible = signal(false);

  readonly activityNotifications = computed<StationNotificationItem[]>(() => {
    const user = this.currentUser();
    if (!user?.id) return [];

    return this.notificationsState.getActivityNotificationsByUser(user.id);
  });

  readonly friendRequests = computed<FriendRequestItem[]>(() => {
    const user = this.currentUser();
    if (!user?.id) return [];

    return this.notificationsState.getPendingFriendRequestsForUser(user.id);
  });

  readonly currentTabCount = computed(() => {
    return this.activeTab() === 'ACTIVIDAD'
      ? this.activityNotifications().length
      : this.friendRequests().length;
  });

  readonly hasUnreadActivity = computed(() => {
    const user = this.currentUser();
    if (!user?.id) return false;

    return this.notificationsState.hasUnreadActivityForUser(user.id);
  });

  readonly hasUnreadRequests = computed(() => {
    const user = this.currentUser();
    if (!user?.id) return false;

    return this.notificationsState.hasUnreadRequestsForUser(user.id);
  });

  ngOnInit(): void {
    // Load persisted state so a page reload or a fresh navigation doesn't
    // start empty. Reset the sidebar bell counter — user IS viewing them now.
    this.notificationsState.loadNotifications();
    this.notificationsState.loadPendingFriendRequests();
    this.notificationsState.resetUnseenCount();
    this.markCurrentTabAsSeen();
  }

  /* ===================== */
  /* TABS */
  /* ===================== */
  setActiveTab(tab: NotificationsTab): void {
    this.activeTab.set(tab);
    this.markCurrentTabAsSeen();
  }

  isTabActive(tab: NotificationsTab): boolean {
    return this.activeTab() === tab;
  }

  private markCurrentTabAsSeen(): void {
    const user = this.currentUser();
    if (!user?.id) return;

    if (this.activeTab() === 'ACTIVIDAD') {
      this.notificationsState.markActivityAsReadForUser(user.id);
      return;
    }

    this.notificationsState.markRequestsAsViewedForUser(user.id);
  }

  /* ===================== */
  /* ACTIVITY */
  /* ===================== */
  goToNotificationStation(notification: StationNotificationItem): void {
    const directStationId = notification.meta.stationId;
    if (directStationId) {
      this.router.navigate(['/user/station', directStationId]);
      return;
    }

    // MENTION notifications only carry a commentId — resolve the station it
    // belongs to via realtime-api-ms and then navigate.
    const commentId = notification.meta.commentId;
    if (!commentId) return;

    this.http
      .get<{ station_id?: string }>(
        `${this.gatewayUrl}/api/v1/realtime/comments/${commentId}`,
      )
      .pipe(catchError(() => of(null)))
      .subscribe((comment) => {
        const stationId = comment?.station_id;
        if (!stationId) return;
        this.router.navigate(['/user/station', stationId]);
      });
  }

  openDeleteNotificationModal(notification: StationNotificationItem): void {
    this.selectedNotificationToDelete.set(notification);
    this.isDeleteModalOpen.set(true);
  }

  closeDeleteNotificationModal(): void {
    this.isDeleteModalOpen.set(false);
    this.selectedNotificationToDelete.set(null);
  }

  confirmDeleteNotification(): void {
    const notification = this.selectedNotificationToDelete();
    if (!notification) return;

    this.notificationsState.deleteNotification(notification.id);
    this.closeDeleteNotificationModal();
    this.showToast('Notificación eliminada');
  }

  /* ===================== */
  /* REQUESTS */
  /* ===================== */
  acceptRequest(request: FriendRequestItem): void {
    const username = request.requesterName ?? 'ese usuario';
    this.notificationsState.acceptFriendRequest(request.id!, () => {
      this.showToast(`Ahora tú y @${username} son amigos`);
    });
  }

  rejectRequest(request: FriendRequestItem): void {
    this.notificationsState.rejectFriendRequest(request.id!);
    this.showToast('Solicitud rechazada');
  }

  /* ===================== */
  /* UI HELPERS */
  /* ===================== */
  getNotificationAvatar(notification: StationNotificationItem): string {
    return notification.meta.actorAvatarUrl || '/assets/icons/avatar-placeholder.png';
  }

  getRequestAvatar(request: FriendRequestItem): string {
    return request.requesterAvatarUrl || '/assets/icons/avatar-placeholder.png';
  }

  trackByNotification(_: number, notification: StationNotificationItem): string {
    return notification.id;
  }

  trackByRequest(_: number, request: FriendRequestItem): string {
    return request.id ?? '';
  }

  /* ===================== */
  /* TOAST */
  /* ===================== */
  private showToast(message: string): void {
    this.toastMessage.set(message);
    this.isToastVisible.set(true);

    window.setTimeout(() => {
      this.isToastVisible.set(false);
      this.toastMessage.set('');
    }, 2200);
  }
}
