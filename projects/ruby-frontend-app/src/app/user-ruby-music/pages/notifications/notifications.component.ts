import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  FriendRequestItem,
  NotificationsState,
  StationNotificationItem,
} from '../../state/notifications.state';
import { AuthState } from '../../../ruby-auth-ui/auth/state/auth.state';

type NotificationsTab = 'ACTIVIDAD' | 'SOLICITUDES';

interface StoredUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
})
export class NotificationsComponent {
  private readonly router = inject(Router);
  private readonly authState = inject(AuthState);
  private readonly notificationsState = inject(NotificationsState);

  private readonly AUTH_USERS_KEY = 'ruby_auth_users';

  readonly currentUser = this.authState.currentUser;

  readonly activeTab = signal<NotificationsTab>('ACTIVIDAD');

  readonly isDeleteModalOpen = signal(false);
  readonly selectedNotificationToDelete = signal<StationNotificationItem | null>(null);

  readonly toastMessage = signal('');
  readonly isToastVisible = signal(false);

  readonly usersCatalog = signal<StoredUser[]>(
    this.loadStorageArray<StoredUser>(this.AUTH_USERS_KEY)
  );

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

  constructor() {
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
    const stationId = notification.meta.stationId;
    if (!stationId) return;

    this.router.navigate(['/user/station', stationId]);
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
    this.notificationsState.acceptFriendRequest(request.id);
    this.showToast('Solicitud aceptada');
  }

  rejectRequest(request: FriendRequestItem): void {
    this.notificationsState.rejectFriendRequest(request.id);
    this.showToast('Solicitud rechazada');
  }

  /* ===================== */
  /* UI HELPERS */
  /* ===================== */
  getNotificationAvatar(notification: StationNotificationItem): string {
    const actorUserId = notification.meta.actorUserId;
    if (!actorUserId) {
      return '/assets/icons/avatar-placeholder.png';
    }

    const user = this.usersCatalog().find(item => item.id === actorUserId);
    return user?.avatarUrl || '/assets/icons/avatar-placeholder.png';
  }

  getRequestAvatar(request: FriendRequestItem): string {
    return request.requesterAvatarUrl || '/assets/icons/avatar-placeholder.png';
  }

  trackByNotification(_: number, notification: StationNotificationItem): string {
    return notification.id;
  }

  trackByRequest(_: number, request: FriendRequestItem): string {
    return request.id;
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

  /* ===================== */
  /* STORAGE */
  /* ===================== */
  private loadStorageArray<T>(storageKey: string): T[] {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
}