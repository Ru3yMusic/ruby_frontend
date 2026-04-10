import { Injectable, computed, signal } from '@angular/core';

export interface StationNotificationItem {
  id: string;
  userId: string;
  type: 'STATION_REPLY' | 'FRIEND_REQUEST';
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  meta: {
    stationId?: string;
    stationName?: string;
    actorUserId?: string;
    actorUserName?: string;
    commentId?: string;
  };
}

export interface FriendRequestItem {
  id: string;
  requesterUserId: string;
  requesterName: string;
  requesterAvatarUrl: string | null;
  addresseeUserId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
  viewedByAddressee?: boolean;
}

export interface FriendshipItem {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationsState {
  private readonly NOTIFICATIONS_KEY = 'ruby_notifications';
  private readonly FRIEND_REQUESTS_KEY = 'ruby_friend_requests';
  private readonly FRIENDSHIPS_KEY = 'ruby_friendships';

  private readonly _notifications = signal<StationNotificationItem[]>(
    this.loadStorageArray<StationNotificationItem>(this.NOTIFICATIONS_KEY)
  );
  readonly notifications = this._notifications.asReadonly();

  private readonly _friendRequests = signal<FriendRequestItem[]>(
    this.loadStorageArray<FriendRequestItem>(this.FRIEND_REQUESTS_KEY)
  );
  readonly friendRequests = this._friendRequests.asReadonly();

  private readonly _friendships = signal<FriendshipItem[]>(
    this.loadStorageArray<FriendshipItem>(this.FRIENDSHIPS_KEY)
  );
  readonly friendships = this._friendships.asReadonly();

  readonly totalNotifications = computed(() => this._notifications().length);
  readonly totalFriendRequests = computed(() => this._friendRequests().length);

  /* ===================== */
  /* GETTERS */
  /* ===================== */
  getActivityNotificationsByUser(userId: string): StationNotificationItem[] {
    return this._notifications()
      .filter(item => item.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getPendingFriendRequestsForUser(userId: string): FriendRequestItem[] {
    return this._friendRequests()
      .filter(
        request =>
          request.addresseeUserId === userId &&
          request.status === 'PENDING'
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  hasUnreadActivityForUser(userId: string): boolean {
    return this._notifications().some(
      item => item.userId === userId && !item.isRead
    );
  }

  hasUnreadRequestsForUser(userId: string): boolean {
    return this._friendRequests().some(
      request =>
        request.addresseeUserId === userId &&
        request.status === 'PENDING' &&
        request.viewedByAddressee !== true
    );
  }

  /* ===================== */
  /* CREATE / SYNC */
  /* ===================== */
  createNotification(payload: {
    userId: string;
    type: 'STATION_REPLY' | 'FRIEND_REQUEST';
    title: string;
    message: string;
    meta: {
      stationId?: string;
      stationName?: string;
      actorUserId?: string;
      actorUserName?: string;
      commentId?: string;
    };
  }): StationNotificationItem {
    const newNotification: StationNotificationItem = {
      id: this.generateId('notification'),
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      createdAt: new Date().toISOString(),
      isRead: false,
      meta: payload.meta,
    };

    const updated = [...this._notifications(), newNotification];
    this.persistNotifications(updated);

    return newNotification;
  }

  createFriendRequest(payload: {
    requesterUserId: string;
    requesterName: string;
    requesterAvatarUrl: string | null;
    addresseeUserId: string;
  }): FriendRequestItem | null {
    if (payload.requesterUserId === payload.addresseeUserId) {
      return null;
    }

    const alreadyPending = this._friendRequests().some(
      request =>
        request.requesterUserId === payload.requesterUserId &&
        request.addresseeUserId === payload.addresseeUserId &&
        request.status === 'PENDING'
    );

    if (alreadyPending) {
      return null;
    }

    const alreadyFriends = this._friendships().some(friendship =>
      (friendship.userAId === payload.requesterUserId &&
        friendship.userBId === payload.addresseeUserId) ||
      (friendship.userAId === payload.addresseeUserId &&
        friendship.userBId === payload.requesterUserId)
    );

    if (alreadyFriends) {
      return null;
    }

    const newRequest: FriendRequestItem = {
      id: this.generateId('friend-request'),
      requesterUserId: payload.requesterUserId,
      requesterName: payload.requesterName,
      requesterAvatarUrl: payload.requesterAvatarUrl,
      addresseeUserId: payload.addresseeUserId,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      viewedByAddressee: false,
    };

    const updated = [...this._friendRequests(), newRequest];
    this.persistFriendRequests(updated);

    return newRequest;
  }

  refreshFromStorage(): void {
    this._notifications.set(
      this.loadStorageArray<StationNotificationItem>(this.NOTIFICATIONS_KEY)
    );

    this._friendRequests.set(
      this.loadStorageArray<FriendRequestItem>(this.FRIEND_REQUESTS_KEY)
    );

    this._friendships.set(
      this.loadStorageArray<FriendshipItem>(this.FRIENDSHIPS_KEY)
    );
  }

  /* ===================== */
  /* ACTIVITY */
  /* ===================== */
  markActivityAsReadForUser(userId: string): void {
    const updated = this._notifications().map(item => {
      if (item.userId !== userId) return item;
      if (item.isRead) return item;

      return {
        ...item,
        isRead: true,
      };
    });

    this.persistNotifications(updated);
  }

  deleteNotification(notificationId: string): void {
    const updated = this._notifications().filter(item => item.id !== notificationId);
    this.persistNotifications(updated);
  }

  /* ===================== */
  /* REQUESTS */
  /* ===================== */
  markRequestsAsViewedForUser(userId: string): void {
    const updated = this._friendRequests().map(request => {
      if (request.addresseeUserId !== userId) return request;
      if (request.status !== 'PENDING') return request;
      if (request.viewedByAddressee === true) return request;

      return {
        ...request,
        viewedByAddressee: true,
      };
    });

    this.persistFriendRequests(updated);
  }

  acceptFriendRequest(requestId: string): void {
  const request = this._friendRequests().find(item => item.id === requestId);
  if (!request || request.status !== 'PENDING') return;

  const alreadyExists = this._friendships().some(friendship =>
    (friendship.userAId === request.requesterUserId &&
      friendship.userBId === request.addresseeUserId) ||
    (friendship.userAId === request.addresseeUserId &&
      friendship.userBId === request.requesterUserId)
  );

  if (!alreadyExists) {
    const newFriendship: FriendshipItem = {
      id: this.generateId('friendship'),
      userAId: request.requesterUserId,
      userBId: request.addresseeUserId,
      createdAt: new Date().toISOString(),
    };

    this.persistFriendships([...this._friendships(), newFriendship]);
  }

  const updatedRequests = this._friendRequests().map(item => {
    if (item.id !== requestId) return item;

    return {
      ...item,
      status: 'ACCEPTED' as const,
      viewedByAddressee: true,
    };
  });

  this.persistFriendRequests(updatedRequests);
}



  rejectFriendRequest(requestId: string): void {
    const updated = this._friendRequests().filter(item => item.id !== requestId);
    this.persistFriendRequests(updated);
  }

  /* ===================== */
  /* HELPERS */
  /* ===================== */
  private persistNotifications(items: StationNotificationItem[]): void {
    this._notifications.set(items);
    localStorage.setItem(this.NOTIFICATIONS_KEY, JSON.stringify(items));
  }

  private persistFriendRequests(items: FriendRequestItem[]): void {
    this._friendRequests.set(items);
    localStorage.setItem(this.FRIEND_REQUESTS_KEY, JSON.stringify(items));
  }

  private persistFriendships(items: FriendshipItem[]): void {
    this._friendships.set(items);
    localStorage.setItem(this.FRIENDSHIPS_KEY, JSON.stringify(items));
  }

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

  private generateId(prefix: string): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `${prefix}-${crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}