import { Observable } from 'rxjs';
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
  WsSongPlayCountChangedPayload,
  WsStationTrackPayload,
  WsSendChatMessagePayload,
  WsSendCommentPayload,
  WsTrackChangedPayload,
  WsUserPresenceChangedPayload,
} from '../models/realtime.models';

/**
 * Port contract for realtime WebSocket communication.
 * Implemented by RealtimeAdapter (socket.io-client).
 *
 * Connection lifecycle:
 *   1. Call connect(token) once the user logs in (pass JWT access token).
 *   2. Call joinStation(stationId, tracks) when entering a station page.
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
  abstract joinStation(stationId: string, tracks: WsStationTrackPayload[]): void;

  /** Emit leave_station — removes presence from the current station room. */
  abstract leaveStation(): void;

  /** Emit send_comment — broadcasts a comment to the station room. */
  abstract sendComment(payload: WsSendCommentPayload): void;

  /**
   * Emit delete_comment — tells the server to broadcast a `comment_deleted`
   * event to everyone in the station room so the card disappears in real time.
   * Persistence is done separately via HTTP DELETE /comments/:id (owner-only).
   */
  abstract deleteComment(stationId: string, commentId: string): void;

  /**
   * Emit like_delta — relays a +1/-1 like-count change for a song to everyone
   * in the station room so their counters update in real time. Persistence is
   * handled by the usual HTTP like endpoint.
   */
  abstract emitLikeDelta(stationId: string, songId: string, delta: 1 | -1): void;

  /**
   * Emit friend_removed — tells the server to relay a friendship removal to
   * both user:{actor} and user:{other} rooms so every open session drops the
   * row instantly. Persistence is done via HTTP DELETE on social-service.
   */
  abstract emitFriendRemoved(friendshipId: string, otherUserId: string): void;

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

  /** Cold Observable — emits track_changed when station timeline advances. */
  abstract onTrackChanged(): Observable<WsTrackChangedPayload>;

  /** Cold Observable — emits comment_deleted events broadcast from the station room. */
  abstract onCommentDeleted(): Observable<WsCommentDeletedPayload>;

  /** Cold Observable — emits like_delta events broadcast from the station room. */
  abstract onLikeDelta(): Observable<WsLikeDeltaPayload>;

  /**
   * Cold Observable — emits user_presence_changed events globally whenever
   * any user joins/leaves a station or disconnects. Consumers must filter by
   * their own list of user IDs (e.g. friendship list).
   */
  abstract onUserPresenceChanged(): Observable<WsUserPresenceChangedPayload>;

  /** Cold Observable — emits friend_removed events targeted at this user's room. */
  abstract onFriendRemoved(): Observable<WsFriendRemovedPayload>;

  /**
   * Cold Observable — emits artist_followers_changed events broadcast globally
   * by realtime-ws-ms whenever any user follows / unfollows an artist (driven
   * by `artist.followed` / `artist.unfollowed` Kafka topics from social-service).
   * Subscribers should apply the delta to their cached followersCount.
   */
  abstract onArtistFollowersChanged(): Observable<WsArtistFollowersChangedPayload>;

  /**
   * Cold Observable — emits song_play_count_changed events broadcast globally
   * whenever interaction-service publishes a `song.played` Kafka event. Use
   * to bump cached playCount in real time without polling catalog-service.
   */
  abstract onSongPlayCountChanged(): Observable<WsSongPlayCountChangedPayload>;

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

  // ─── Music Feed (Kafka music-feed.* topics) ──────────────────────────────
  //
  // Broadcast globally to every authenticated socket. Consumed exclusively by
  // the page-scoped MusicFeedState in /user/music. Other pages MUST NOT
  // subscribe to these streams — the cap+replace logic is page-specific.

  /** Cold Observable — emits when an album becomes publicly visible. */
  abstract onMusicFeedAlbumReleased(): Observable<MusicFeedAlbumReleasedPayload>;

  /** Cold Observable — emits when an artist's isTop flag flips in either direction. */
  abstract onMusicFeedArtistTopChanged(): Observable<MusicFeedArtistTopChangedPayload>;

  /** Cold Observable — emits when a NEW public (non-system) playlist is created. */
  abstract onMusicFeedPlaylistPublicCreated(): Observable<MusicFeedPlaylistPublicCreatedPayload>;

  /** Cold Observable — emits on any privacy flip of a non-system playlist. */
  abstract onMusicFeedPlaylistPrivacyChanged(): Observable<MusicFeedPlaylistPrivacyChangedPayload>;

  /** Cold Observable — emits when a previously-PUBLIC playlist is soft-deleted. */
  abstract onMusicFeedPlaylistDeleted(): Observable<MusicFeedPlaylistDeletedPayload>;
}
