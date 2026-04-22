/**
 * Domain models for WebSocket realtime events.
 * Derived from AsyncAPI spec: api-realtime-ws-ms.yml
 *
 * INSTALLATION REQUIRED:
 *   npm install socket.io-client
 *
 * Gateway routing:
 *   WebSocket: /socket.io/** → realtime-ws-ms:3001 (direct, not Eureka)
 *   REST:      /api/v1/realtime/** → realtime-api-ms:3002 (direct, not Eureka)
 */

export type WsNotificationType =
  | 'COMMENT_REACTION'
  | 'MENTION'
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED';

// ─── Server → Client ────────────────────────────────────────────────────────

/** new_comment — broadcast to all users in station:{stationId} room */
export interface WsCommentPayload {
  commentId: string;
  songId: string;
  stationId: string;
  userId: string;
  username: string;
  profilePhotoUrl: string | null;
  content: string;
  mentions: string[];
  likesCount: number;
  createdAt: string;
}

/** notification — pushed to user:{userId} private room */
export interface WsNotificationPayload {
  notificationId: string;
  actorId: string;
  actorUsername: string;
  actorPhotoUrl: string | null;
  type: WsNotificationType;
  targetId: string;
  targetType: string;
  createdAt: string;
}

/** listener_count — broadcast to station room when count changes */
export interface WsListenerCountPayload {
  stationId: string;
  count: number;
}

/** joined_station — acknowledgement sent to joining client after join_station */
export interface WsJoinedStationPayload {
  stationId: string;
  listenerCount: number;
}

// ─── Client → Server ────────────────────────────────────────────────────────

/** send_comment payload */
export interface WsSendCommentPayload {
  /** Client-generated UUID — idempotency key */
  commentId: string;
  songId: string;
  stationId: string;
  content: string;
  mentions?: string[];
}

/** join_station payload */
export interface WsJoinStationPayload {
  stationId: string;
  songId: string;
}

// ─── Chat Events ─────────────────────────────────────────────────────────────

/**
 * send_chat_message — Client → Server payload.
 * Matches backend SendChatMessageDto (realtime-ws-ms).
 * stationId is included so the gateway can verify the user is in the correct room.
 */
export interface WsSendChatMessagePayload {
  stationId: string;
  content: string;
  mentions?: string[];
}

/**
 * new_chat_message — Server → Client broadcast.
 * Matches backend WsChatMessagePayload (realtime-ws-ms avro-events.types.ts).
 * Broadcast to all users in station:{stationId} room.
 */
export interface WsChatMessagePayload {
  messageId: string;
  stationId: string;
  userId: string;
  username: string;
  profilePhotoUrl: string | null;
  content: string;
  mentions: string[];
  /** ISO-8601 timestamp assigned by the server. */
  timestamp: string;
}

// ─── Comment Like Events ──────────────────────────────────────────────────────

/**
 * like_comment — Client → Server payload.
 * Matches backend LikeCommentDto (realtime-ws-ms gateway/dto/like-comment.dto.ts).
 */
export interface WsLikeCommentPayload {
  commentId: string;
  commentAuthorId: string;
  songId: string;
  stationId: string;
}

/**
 * comment_likes_updated — Server → Client broadcast (optimistic UI).
 * Matches backend WsCommentLikesUpdatedPayload (realtime-ws-ms avro-events.types.ts).
 * Broadcast to all users in station:{stationId} room when a like/unlike occurs.
 */
export interface WsCommentLikesUpdatedPayload {
  commentId: string;
  /** Discriminator: 'like' means +1, 'unlike' means -1. */
  action: 'like' | 'unlike';
  /** userId of the liker (to prevent duplicate-like on the client side). */
  userId: string;
}

// ─── Presence (REST) ─────────────────────────────────────────────────────────

/**
 * POST /presence/users/bulk — request body.
 */
export interface BulkPresenceRequest {
  userIds: string[];
}

/**
 * Presence record for a single user, returned by POST /presence/users/bulk.
 */
export interface UserPresenceInfo {
  online: boolean;
  station_id?: string;
  song_id?: string;
}

/**
 * Response shape of POST /presence/users/bulk.
 * Keyed by userId.
 */
export interface BulkPresenceResult {
  [userId: string]: UserPresenceInfo;
}

/**
 * Enriched friend presence info — produced by ChatStationComponent after
 * merging presence data (BulkPresenceResult), UsersApi data, and station names.
 */
export interface FriendPresenceInfo {
  userId: string;
  friendName: string;
  avatarUrl?: string;
  online: boolean;
  stationId?: string;
  stationName?: string;
}

/** Server → Client: a comment was deleted somewhere in the station room. */
export interface WsCommentDeletedPayload {
  commentId: string;
  stationId: string;
}

/** Server → Client: realtime hint for a song-like counter delta in a station. */
export interface WsLikeDeltaPayload {
  stationId: string;
  songId:    string;
  delta:     1 | -1;
  actorId?:  string;
}

/**
 * Server → Client: a user's presence changed. Broadcast globally whenever a
 * socket joins or leaves a station room, or when the socket disconnects.
 * Clients filter by their own friend list to update UI (e.g. the "Activos
 * estación" cards and the 3 s friend-entered-station toast).
 *
 * `stationId` is the new station the user is in, or null when they left the
 * station or disconnected.
 */
export interface WsUserPresenceChangedPayload {
  userId:    string;
  stationId: string | null;
  online:    boolean;
}

/**
 * Server → Client: a friendship was removed (soft-delete). Emitted by the
 * `friend_removed` handler on ws-ms to BOTH the actor's `user:{id}` room and
 * the removed friend's `user:{id}` room so every open session can drop the
 * row from its local list without reloading.
 */
export interface WsFriendRemovedPayload {
  friendshipId:    string;
  removedByUserId?: string;
}
