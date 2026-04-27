// DEPENDENCY: npm install socket.io-client
// This file will not compile until socket.io-client is installed.

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, EMPTY, Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';
import { API_GATEWAY_URL } from '../../../config/api-gateway-url.token';
import { WS_AUTH_REFRESH_ENABLED } from '../../../config/ws-auth-refresh-enabled.token';
import { RealtimePort } from '../../domain/ports/realtime.port';
import {
  BulkPresenceResult,
  MusicFeedAlbumReleasedPayload,
  MusicFeedArtistTopChangedPayload,
  MusicFeedPlaylistDeletedPayload,
  MusicFeedPlaylistPrivacyChangedPayload,
  MusicFeedPlaylistPublicCreatedPayload,
  WsArtistFollowersChangedPayload,
  WsChatMessagePayload,
  WsCommentDeletedPayload,
  WsCommentLikesUpdatedPayload,
  WsCommentPayload,
  WsFriendRemovedPayload,
  WsJoinedStationPayload,
  WsLikeDeltaPayload,
  WsListenerCountPayload,
  WsNotificationPayload,
  WsSendChatMessagePayload,
  WsSendCommentPayload,
  WsSongPlayCountChangedPayload,
  WsStationTrackPayload,
  WsTrackChangedPayload,
  WsUserPresenceChangedPayload,
} from '../../domain/models/realtime.models';

const AUTH_REFRESH_ACK_TIMEOUT_MS = 2_500;

interface AuthRefreshAck {
  ok: boolean;
  code?: 'TOKEN_EXPIRED' | 'TOKEN_INVALID' | 'USER_MISMATCH' | 'THROTTLED';
}

/**
 * Socket.IO implementation of RealtimePort.
 *
 * Connects to the API gateway (which proxies /socket.io/** → realtime-ws-ms:3001).
 * JWT is passed in Socket.IO handshake auth: { token: 'Bearer <jwt>' }.
 * The gateway validates the JWT and injects X-User-Id into headers for the WS service.
 *
 * Reconnection is handled automatically by socket.io-client (up to 5 attempts,
 * 1 s delay). The socket is replaced on each connect() call.
 */
@Injectable()
export class RealtimeAdapter extends RealtimePort {
  private readonly gatewayUrl = inject(API_GATEWAY_URL);
  private readonly http = inject(HttpClient);
  private readonly wsAuthRefreshEnabled = inject(WS_AUTH_REFRESH_ENABLED, { optional: true }) ?? false;
  private socket: Socket | null = null;
  private currentToken: string | null = null;
  private activeStation: { stationId: string; tracks: WsStationTrackPayload[] } | null = null;
  private authRefreshInFlight = false;
  private readonly socket$ = new BehaviorSubject<Socket | null>(null);
  private readonly debugEnabled = (() => {
    if (typeof window === 'undefined') return false;
    const envFlag = (window as any).__env?.realtimeDebug === true;
    const storageFlag = window.localStorage.getItem('rubytune:realtime-debug') === '1';
    return envFlag || storageFlag;
  })();

  // ─── Connection Lifecycle ─────────────────────────────────────────────────

  connect(token: string): void {
    // Already connected with the same token → nothing to do.
    if (this.socket?.connected && this.currentToken === token) return;

    this.debug('connect() called', {
      hadSocket: !!this.socket,
      connected: this.socket?.connected ?? false,
      tokenExpiresInMs: this.getTokenExpiresInMs(token),
      wsAuthRefreshEnabled: this.wsAuthRefreshEnabled,
    });

    if (this.socket?.connected && this.currentToken !== token) {
      if (this.wsAuthRefreshEnabled) {
        this.tryAuthRefresh(token);
      } else {
        this.recreateSocket(token);
      }
      return;
    }

    this.recreateSocket(token);
  }

  private tryAuthRefresh(token: string): void {
    const socket = this.socket;
    if (!socket || !socket.connected || this.authRefreshInFlight) {
      this.recreateSocket(token);
      return;
    }

    this.authRefreshInFlight = true;
    this.debug('auth_refresh emit', { tokenExpiresInMs: this.getTokenExpiresInMs(token) });
    socket
      .timeout(AUTH_REFRESH_ACK_TIMEOUT_MS)
      .emit('auth_refresh', { token: `Bearer ${token}` }, (err: Error | null, ack: AuthRefreshAck) => {
        this.authRefreshInFlight = false;

        this.debug('auth_refresh ack', {
          hasError: !!err,
          error: err?.message,
          ack,
        });

        if (!err && ack?.ok) {
          this.currentToken = token;
          return;
        }

        this.recreateSocket(token);
      });
  }

  private recreateSocket(token: string): void {
    this.socket?.disconnect();

    // Different token (or stale socket) → tear down and reopen so the handshake
    // carries the fresh JWT. Critical after a profile edit that re-issues the
    // access token with an updated `displayName` claim — the WS identity on the
    // server side (socket.data.username) is only populated at handshake time.
    this.currentToken = token;
    this.socket = io(this.gatewayUrl, {
      auth: { token: `Bearer ${token}` },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      timeout: 20000,
    });

    this.debug('socket recreated', {
      gatewayUrl: this.gatewayUrl,
      tokenExpiresInMs: this.getTokenExpiresInMs(token),
    });

    this.socket.on('connect_error', (err: Error) => {
      const message = (err?.message ?? '').toLowerCase();
      this.debug('socket connect_error', { message: err?.message });
      if (!message.includes('jwt expired')) return;

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ruby-ws-auth-expired'));
      }
    });

    this.socket.on('connect', () => {
      this.debug('socket connected', {
        socketId: this.socket?.id,
        activeStation: this.activeStation,
      });
      const station = this.activeStation;
      if (!station) return;
      this.socket?.emit('join_station', station);
      this.debug('rejoin station emitted', station);
    });

    this.socket.on('disconnect', (reason) => {
      this.debug('socket disconnected', { reason, socketId: this.socket?.id });
    });

    this.socket.io.on('reconnect_attempt', (attempt) => {
      this.debug('socket reconnect_attempt', { attempt });
    });

    this.socket.io.on('reconnect', (attempt) => {
      this.debug('socket reconnect', { attempt });
    });

    this.socket.io.on('reconnect_error', (err) => {
      this.debug('socket reconnect_error', { message: err?.message });
    });

    // Publish the new socket so subscribers created before connect() can now
    // register their listeners (fixes race condition where components subscribe
    // in ngOnInit before the auth flow opens the WS).
    this.socket$.next(this.socket);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.currentToken = null;
    this.activeStation = null;
    this.socket$.next(null);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // ─── Client → Server Emitters ─────────────────────────────────────────────

  joinStation(stationId: string, tracks: WsStationTrackPayload[]): void {
    this.activeStation = { stationId, tracks };
    this.socket?.emit('join_station', { stationId, tracks });
  }

  leaveStation(): void {
    this.activeStation = null;
    this.socket?.emit('leave_station');
  }

  sendComment(payload: WsSendCommentPayload): void {
    this.socket?.emit('send_comment', payload);
  }

  deleteComment(stationId: string, commentId: string): void {
    this.socket?.emit('delete_comment', { stationId, commentId });
  }

  emitLikeDelta(stationId: string, songId: string, delta: 1 | -1): void {
    this.socket?.emit('like_delta', { stationId, songId, delta });
  }

  emitFriendRemoved(friendshipId: string, otherUserId: string): void {
    this.socket?.emit('friend_removed', { friendshipId, otherUserId });
  }

  pingPresence(): void {
    this.socket?.emit('ping_presence');
  }

  // ─── Server → Client Observable Streams ──────────────────────────────────

  onNewComment(): Observable<WsCommentPayload> {
    return this.fromSocketEvent<WsCommentPayload>('new_comment');
  }

  onNotification(): Observable<WsNotificationPayload> {
    return this.fromSocketEvent<WsNotificationPayload>('notification');
  }

  onListenerCount(): Observable<WsListenerCountPayload> {
    return this.fromSocketEvent<WsListenerCountPayload>('listener_count');
  }

  onJoinedStation(): Observable<WsJoinedStationPayload> {
    return this.fromSocketEvent<WsJoinedStationPayload>('joined_station');
  }

  onTrackChanged(): Observable<WsTrackChangedPayload> {
    return this.fromSocketEvent<WsTrackChangedPayload>('track_changed');
  }

  onCommentDeleted(): Observable<WsCommentDeletedPayload> {
    return this.fromSocketEvent<WsCommentDeletedPayload>('comment_deleted');
  }

  onLikeDelta(): Observable<WsLikeDeltaPayload> {
    return this.fromSocketEvent<WsLikeDeltaPayload>('like_delta');
  }

  onUserPresenceChanged(): Observable<WsUserPresenceChangedPayload> {
    return this.fromSocketEvent<WsUserPresenceChangedPayload>('user_presence_changed');
  }

  onFriendRemoved(): Observable<WsFriendRemovedPayload> {
    return this.fromSocketEvent<WsFriendRemovedPayload>('friend_removed');
  }

  onArtistFollowersChanged(): Observable<WsArtistFollowersChangedPayload> {
    return this.fromSocketEvent<WsArtistFollowersChangedPayload>(
      'artist_followers_changed',
    );
  }

  onSongPlayCountChanged(): Observable<WsSongPlayCountChangedPayload> {
    return this.fromSocketEvent<WsSongPlayCountChangedPayload>(
      'song_play_count_changed',
    );
  }

  // ─── Music Feed (Kafka music-feed.* topics) ──────────────────────────────

  onMusicFeedAlbumReleased(): Observable<MusicFeedAlbumReleasedPayload> {
    return this.fromSocketEvent<MusicFeedAlbumReleasedPayload>(
      'music_feed_album_released',
    );
  }

  onMusicFeedArtistTopChanged(): Observable<MusicFeedArtistTopChangedPayload> {
    return this.fromSocketEvent<MusicFeedArtistTopChangedPayload>(
      'music_feed_artist_top_changed',
    );
  }

  onMusicFeedPlaylistPublicCreated(): Observable<MusicFeedPlaylistPublicCreatedPayload> {
    return this.fromSocketEvent<MusicFeedPlaylistPublicCreatedPayload>(
      'music_feed_playlist_public_created',
    );
  }

  onMusicFeedPlaylistPrivacyChanged(): Observable<MusicFeedPlaylistPrivacyChangedPayload> {
    return this.fromSocketEvent<MusicFeedPlaylistPrivacyChangedPayload>(
      'music_feed_playlist_privacy_changed',
    );
  }

  onMusicFeedPlaylistDeleted(): Observable<MusicFeedPlaylistDeletedPayload> {
    return this.fromSocketEvent<MusicFeedPlaylistDeletedPayload>(
      'music_feed_playlist_deleted',
    );
  }

  // ─── Chat ─────────────────────────────────────────────────────────────────

  /**
   * Emits `send_chat_message` to the server.
   * The server (ChatGateway) requires the user to be in a station room first
   * (socket.data.stationId must be set via join_station).
   */
  sendChatMessage(payload: WsSendChatMessagePayload): void {
    this.socket?.emit('send_chat_message', payload);
  }

  /** Cold Observable — wraps the `new_chat_message` server→client broadcast. */
  onChatMessage(): Observable<WsChatMessagePayload> {
    return this.fromSocketEvent<WsChatMessagePayload>('new_chat_message');
  }

  // ─── Comment Likes ────────────────────────────────────────────────────────

  /**
   * Like a comment via HTTP POST /comments/:id/like.
   * The backend processes the like via Kafka and broadcasts `comment_likes_updated`
   * to the station room — no WS emit needed here.
   */
  likeComment(commentId: string): Observable<void> {
    return this.http
      .post<void>(
        `${this.gatewayUrl}/api/v1/realtime/comments/${commentId}/like`,
        {}
      )
      .pipe(map(() => undefined));
  }

  /**
   * Unlike a comment via HTTP DELETE /comments/:id/like.
   * The backend processes the unlike via Kafka and broadcasts `comment_likes_updated`
   * to the station room.
   */
  unlikeComment(commentId: string): Observable<void> {
    return this.http
      .delete<void>(
        `${this.gatewayUrl}/api/v1/realtime/comments/${commentId}/like`
      )
      .pipe(map(() => undefined));
  }

  /**
   * Cold Observable — wraps the `comment_likes_updated` server→client broadcast.
   * The server emits this after processing a like/unlike event via Kafka.
   */
  onCommentLikesUpdated(): Observable<WsCommentLikesUpdatedPayload> {
    return this.fromSocketEvent<WsCommentLikesUpdatedPayload>('comment_likes_updated');
  }

  // ─── Presence (REST) ─────────────────────────────────────────────────────

  /**
   * Fetch presence info for multiple users via HTTP POST /presence/users/bulk.
   * Body: { userIds: string[] }
   * Returns: { [userId]: { online, station_id?, song_id? } }
   *
   * Gateway routing: `/api/v1/realtime/presence/**` is proxied to
   * realtime-ws-ms:3001 (where presence state lives in Redis). Comments at
   * `/api/v1/realtime/comments/**` go to realtime-api-ms:3002 (Mongo).
   * See `config-server/.../config/api-gateway.yml` for the canonical routes.
   */
  getBulkPresence(userIds: string[]): Observable<BulkPresenceResult> {
    return this.http.post<BulkPresenceResult>(
      `${this.gatewayUrl}/api/v1/realtime/presence/users/bulk`,
      { userIds }
    );
  }

  // ─── Internal Helpers ─────────────────────────────────────────────────────

  /**
   * Cold Observable that registers/unregisters a socket.io event listener.
   *
   * Waits for a live socket via socket$ instead of failing when the subscriber
   * beats connect(). On reconnect (connect() replacing the socket) the listener
   * is automatically re-registered on the new socket and torn down from the
   * old one. Unsubscribing (e.g. takeUntilDestroyed) removes the listener.
   */
  private fromSocketEvent<T>(event: string): Observable<T> {
    return this.socket$.pipe(
      switchMap(socket => {
        if (!socket) return EMPTY;
        return new Observable<T>(observer => {
          const handler = (data: T) => observer.next(data);
          socket.on(event, handler);
          return () => socket.off(event, handler);
        });
      }),
    );
  }

  private getTokenExpiresInMs(token: string): number | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const decoded = JSON.parse(atob(padded)) as { exp?: number };
      if (!decoded.exp) return null;
      return decoded.exp * 1000 - Date.now();
    } catch {
      return null;
    }
  }

  private debug(message: string, extra?: unknown): void {
    if (!this.debugEnabled) return;
    if (extra === undefined) {
      console.debug(`[RealtimeAdapter] ${message}`);
      return;
    }
    console.debug(`[RealtimeAdapter] ${message}`, extra);
  }
}
