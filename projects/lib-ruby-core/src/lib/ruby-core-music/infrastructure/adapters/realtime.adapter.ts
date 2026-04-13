// DEPENDENCY: npm install socket.io-client
// This file will not compile until socket.io-client is installed.

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { API_GATEWAY_URL } from '../../../config/api-gateway-url.token';
import { RealtimePort } from '../../domain/ports/realtime.port';
import {
  WsChatMessagePayload,
  WsCommentLikesUpdatedPayload,
  WsCommentPayload,
  WsJoinedStationPayload,
  WsListenerCountPayload,
  WsLikeCommentPayload,
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
   * Emits `like_comment` to the server.
   * Payload matches backend LikeCommentDto:
   *   commentId, commentAuthorId, songId, stationId.
   */
  likeComment(payload: WsLikeCommentPayload): void {
    this.socket?.emit('like_comment', payload);
  }

  /**
   * Cold Observable — wraps the `comment_likes_updated` server→client broadcast.
   * The server emits this after processing a like/unlike event via Kafka.
   */
  onCommentLikesUpdated(): Observable<WsCommentLikesUpdatedPayload> {
    return this.fromSocketEvent<WsCommentLikesUpdatedPayload>('comment_likes_updated');
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
