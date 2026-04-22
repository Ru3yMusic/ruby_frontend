// DEPENDENCY: npm install socket.io-client
// This file will not compile until socket.io-client is installed.

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, EMPTY, Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';
import { API_GATEWAY_URL } from '../../../config/api-gateway-url.token';
import { RealtimePort } from '../../domain/ports/realtime.port';
import {
  BulkPresenceResult,
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
  WsUserPresenceChangedPayload,
} from '../../domain/models/realtime.models';

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
  private socket: Socket | null = null;
  private currentToken: string | null = null;
  private readonly socket$ = new BehaviorSubject<Socket | null>(null);

  // ─── Connection Lifecycle ─────────────────────────────────────────────────

  connect(token: string): void {
    // Already connected with the same token → nothing to do.
    if (this.socket?.connected && this.currentToken === token) return;

    // Different token (or stale socket) → tear down and reopen so the handshake
    // carries the fresh JWT. Critical after a profile edit that re-issues the
    // access token with an updated `displayName` claim — the WS identity on the
    // server side (socket.data.username) is only populated at handshake time.
    this.socket?.disconnect();

    this.currentToken = token;
    this.socket = io(this.gatewayUrl, {
      auth: { token: `Bearer ${token}` },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
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
    this.socket$.next(null);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // ─── Client → Server Emitters ─────────────────────────────────────────────

  joinStation(stationId: string, songId: string): void {
    this.socket?.emit('join_station', { stationId, songId });
  }

  leaveStation(): void {
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
   * NOTE: Gateway routing open question — /api/v1/realtime/** may route to
   * realtime-api-ms:3002 instead of realtime-ws-ms:3001 where presence lives.
   * Verify gateway config if this endpoint returns 404.
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
}
