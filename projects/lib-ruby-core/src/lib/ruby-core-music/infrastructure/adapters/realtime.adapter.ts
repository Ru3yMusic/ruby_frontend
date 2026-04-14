// DEPENDENCY: npm install socket.io-client
// This file will not compile until socket.io-client is installed.

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';
import { API_GATEWAY_URL } from '../../../config/api-gateway-url.token';
import { RealtimePort } from '../../domain/ports/realtime.port';
import {
  BulkPresenceResult,
  WsChatMessagePayload,
  WsCommentLikesUpdatedPayload,
  WsCommentPayload,
  WsJoinedStationPayload,
  WsListenerCountPayload,
  WsNotificationPayload,
  WsSendChatMessagePayload,
  WsSendCommentPayload,
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

  // ─── Connection Lifecycle ─────────────────────────────────────────────────

  connect(token: string): void {
    if (this.socket?.connected) return;

    // Disconnect stale socket if present (e.g. token refresh scenario)
    this.socket?.disconnect();

    this.socket = io(this.gatewayUrl, {
      auth: { token: `Bearer ${token}` },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
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
   * Creates a cold Observable that registers/unregisters a socket.io event
   * listener. The listener is automatically removed when the subscriber
   * unsubscribes (e.g. via takeUntilDestroyed in the component).
   */
  private fromSocketEvent<T>(event: string): Observable<T> {
    return new Observable<T>(observer => {
      const socket = this.socket;

      if (!socket) {
        // No active connection — complete immediately so callers don't hang.
        observer.complete();
        return;
      }

      const handler = (data: T) => observer.next(data);
      socket.on(event, handler);

      // Teardown: remove the listener when the subscription is disposed.
      return () => {
        socket.off(event, handler);
      };
    });
  }
}
