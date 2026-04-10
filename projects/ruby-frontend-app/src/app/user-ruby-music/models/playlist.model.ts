export type PlaylistVisibility = 'PUBLIC' | 'PRIVATE';
export type PlaylistType = 'SYSTEM' | 'CUSTOM';
export type PlaylistSystemType = 'LIKED_SONGS' | null;

export interface Playlist {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  visibility: PlaylistVisibility;
  type: PlaylistType;
  systemType: PlaylistSystemType;
  songIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistView extends Playlist {
  songsCount: number;
  ownerName: string;
  ownerAvatarUrl: string | null;
  isLikedSongs: boolean;
}