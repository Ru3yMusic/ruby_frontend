import { Observable } from 'rxjs';
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
} from '../models/realtime.models';

/**
 * Port contract for realtime WebSocket communication.
 * Implemented by RealtimeAdapter (socket.io-client).
 *
 * Connection lifecycle:
 *   1. Call connect(token) once the user logs in (pass JWT access token).
 *   2. Call joinStation(stationId, songId) when entering a station page.
 *   3. Call leaveStation() when leaving a station (ngOnDestroy or route change).
 *   4. Call disconnect() when the user logs out.
 *
 * Event streams are cold Observables — each subscribe call registers a new
 * socket.io listener. Unsubscribe (or use takeUntilDestroyed) to clean up.
 */
export abstract class RealtimePort {
  /** Open a Socket.IO connection authenticated with the given JWT access token. */
  abstract connect(token: string): void;

  /** Close the Socket.IO connection and release the socket. */
  abstract disconnect(): void;

  /** Emit join_station — registers presence in the station room. */
  abstract joinStation(stationId: string, songId: string): void;

  /** Emit leave_station — removes presence from the current station room. */
  abstract leaveStation(): void;

  /** Emit send_comment — broadcasts a comment to the station room. */
  abstract sendComment(payload: WsSendCommentPayload): void;

  /**
   * Emit ping_presence — heartbeat to keep Redis TTL alive.
   * The server expects this every ~60 s; TTL resets to 300 s on receipt.
   */
  abstract pingPresence(): void;

  /** Cold Observable — emits each new_comment event in the current station room. */
  abstract onNewComment(): Observable<WsCommentPayload>;

  /** Cold Observable — emits each notification event pushed to the user's private room. */
  abstract onNotification(): Observable<WsNotificationPayload>;

  /** Cold Observable — emits listener_count changes for the current station room. */
  abstract onListenerCount(): Observable<WsListenerCountPayload>;

  /** Cold Observable — emits joined_station ack after a successful join_station emit. */
  abstract onJoinedStation(): Observable<WsJoinedStationPayload>;

  /** Returns whether the underlying socket is currently connected. */
  abstract isConnected(): boolean;

  // ─── Chat ─────────────────────────────────────────────────────────────────

  /**
   * Emit send_chat_message — sends a chat message to the current station room.
   * The user must have called joinStation() first; the server will reject the
   * event if socket.data.stationId is not set.
   */
  abstract sendChatMessage(payload: WsSendChatMessagePayload): void;

  /**
   * Cold Observable — emits each new_chat_message event broadcast by the server
   * to the station room the user has joined.
   */
  abstract onChatMessage(): Observable<WsChatMessagePayload>;

  // ─── Comment Likes ────────────────────────────────────────────────────────

  /**
   * Like a comment via HTTP POST /comments/:id/like.
   * Returns an Observable that completes when the request succeeds.
   * The server broadcasts a `comment_likes_updated` WS event after processing.
   */
  abstract likeComment(commentId: string): Observable<void>;

  /**
   * Unlike a comment via HTTP DELETE /comments/:id/like.
   * Returns an Observable that completes when the request succeeds.
   * The server broadcasts a `comment_likes_updated` WS event after processing.
   */
  abstract unlikeComment(commentId: string): Observable<void>;

  /**
   * Cold Observable — emits comment_likes_updated events broadcast by the server
   * after a like/unlike is processed. Use to apply optimistic UI updates.
   */
  abstract onCommentLikesUpdated(): Observable<WsCommentLikesUpdatedPayload>;

  // ─── Presence (REST) ─────────────────────────────────────────────────────

  /**
   * Fetch presence info for multiple users in one HTTP POST.
   * Calls POST /presence/users/bulk with { userIds: string[] }.
   * Returns a map of userId → UserPresenceInfo.
   */
  abstract getBulkPresence(userIds: string[]): Observable<BulkPresenceResult>;
}
