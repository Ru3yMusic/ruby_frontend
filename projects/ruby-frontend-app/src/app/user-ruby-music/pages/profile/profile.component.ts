import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthState, CurrentUser } from '../../../ruby-auth-ui/auth/state/auth.state';
import { Playlist } from '../../models/playlist.model';
import { PlaylistState } from '../../state/playlist.state';
import { PlayerState } from '../../state/player.state';

interface ProfilePlaylistCard {
  id: string;
  title: string;
  coverUrl: string | null;
  ownerName: string;
  isPublic: boolean;
  songsCount: number;
  isLikedSongs: boolean;
}

interface FollowedArtistCard {
  id: string;
  name: string;
  photoUrl: string;
  typeLabel: string;
  monthlyListeners: string;
}

interface AuthUserStorageItem {
  id: string;
  email: string;
  password: string;
  authProvider: 'EMAIL';
  name: string;
  birthDate: string;
  gender: string;
  avatarUrl: string | null;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'BLOCKED' | 'INACTIVE';
  blockReason: string | null;
  blockedAt: string | null;
  onboardingCompleted: boolean;
  selectedStationIds: string[];
  createdAt: string;
}

interface AdminUserStorageItem {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  status: 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';
  createdAt: string;
  reportCount: number;
  blockReason: string | null;
  blockedAt: string | null;
}

interface LibraryItem {
  id: string;
  userId: string;
  itemType: 'ARTIST' | 'ALBUM';
  itemId: string;
  addedAt: string;
}

interface StoredArtist {
  id: string;
  name: string;
  photoUrl: string;
  bio: string;
  isTop: boolean;
  followersCount: string;
  monthlyListeners: string;
  createdAt: string;
}

interface StoredSong {
  id: string;
  title: string;
  artistId: string;
  albumId: string | null;
  genreId: string;
  coverUrl: string;
  audioUrl: string;
  durationSeconds: number;
  lyrics: string | null;
  playCount: number;
  likesCount: number;
  createdAt: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent {
  private readonly authState = inject(AuthState);
  private readonly playlistState = inject(PlaylistState);
  private readonly playerState = inject(PlayerState);
  private readonly router = inject(Router);

  private readonly AUTH_USERS_KEY = 'ruby_auth_users';
  private readonly ADMIN_USERS_KEY = 'ruby_users';
  private readonly USER_LIBRARY_KEY = 'ruby_user_library';
  private readonly ARTISTS_KEY = 'ruby_artists';
  private readonly SONGS_KEY = 'ruby_songs';

  private readonly defaultTopColor = '#5b5b5b';
  private readonly defaultAvatar = '/assets/icons/avatar-placeholder.png';

  readonly currentUser = this.authState.currentUser;

  readonly isEditModalOpen = signal(false);
  readonly isAvatarHovered = signal(false);

  readonly editName = signal('');
  readonly tempAvatarUrl = signal<string | null>(null);
  readonly headerAccentColor = signal(this.defaultTopColor);

  private readonly userLibrary = signal<LibraryItem[]>(this.loadStorageArray<LibraryItem>(this.USER_LIBRARY_KEY));
  private readonly artistsCatalog = signal<StoredArtist[]>(this.loadStorageArray<StoredArtist>(this.ARTISTS_KEY));
  private readonly songsCatalog = signal<StoredSong[]>(this.loadStorageArray<StoredSong>(this.SONGS_KEY));

  readonly displayName = computed(() => {
    const user = this.currentUser();
    return user?.name?.trim() || 'Usuario RubyTune';
  });

  readonly displayAvatarUrl = computed(() => {
    return this.tempAvatarUrl() || this.currentUser()?.avatarUrl || this.defaultAvatar;
  });

  readonly publicPlaylists = computed<ProfilePlaylistCard[]>(() => {
    const user = this.currentUser();
    if (!user) return [];

    const playlists = this.playlistState
      .getPublicPlaylistsByUser(user.id)
      .filter(
        playlist => !(playlist.type === 'SYSTEM' && playlist.systemType === 'LIKED_SONGS')
      );

    return playlists.map((playlist: Playlist) => ({
      id: playlist.id,
      title: playlist.name,
      coverUrl: playlist.coverUrl,
      ownerName: user.name,
      isPublic: playlist.visibility === 'PUBLIC',
      songsCount: playlist.songIds.length,
      isLikedSongs: playlist.type === 'SYSTEM' && playlist.systemType === 'LIKED_SONGS',
    }));
  });

  readonly followedArtists = computed<FollowedArtistCard[]>(() => {
    const user = this.currentUser();
    if (!user?.id) return [];

    const followedArtistIds = this.userLibrary()
      .filter(item => item.userId === user.id && item.itemType === 'ARTIST')
      .map(item => item.itemId);

    return followedArtistIds
      .map(artistId => this.artistsCatalog().find(artist => artist.id === artistId) ?? null)
      .filter((artist): artist is StoredArtist => !!artist)
      .map(artist => ({
        id: artist.id,
        name: artist.name,
        photoUrl: artist.photoUrl || this.defaultAvatar,
        typeLabel: 'Artista',
        monthlyListeners: this.formatNumber(Number(artist.monthlyListeners) || 0),
      }));
  });

  readonly publicPlaylistCount = computed(() => this.publicPlaylists().length);

  readonly gradientStyle = computed(() => {
    const color = this.headerAccentColor();
    return `linear-gradient(180deg, ${color} 0%, #121212 68%, #0d0d0d 100%)`;
  });

  constructor() {
    this.bootstrapProfileView();
  }

  /* ===================== */
  /* INIT */
  /* ===================== */
  private bootstrapProfileView(): void {
    const user = this.currentUser();

    this.editName.set(user?.name ?? '');
    this.tempAvatarUrl.set(user?.avatarUrl ?? null);

    if (user?.id) {
      this.playlistState.ensureLikedSongsPlaylist(user.id);
    }

    if (user?.avatarUrl) {
      this.updateAccentFromImage(user.avatarUrl);
    } else {
      this.headerAccentColor.set(this.defaultTopColor);
    }
  }

  /* ===================== */
  /* UI AVATAR */
  /* ===================== */
  onAvatarMouseEnter(): void {
    this.isAvatarHovered.set(true);
  }

  onAvatarMouseLeave(): void {
    this.isAvatarHovered.set(false);
  }

  openEditModal(): void {
    const user = this.currentUser();

    this.editName.set(user?.name ?? '');
    this.tempAvatarUrl.set(user?.avatarUrl ?? null);
    this.isEditModalOpen.set(true);
  }

  closeEditModal(): void {
    const user = this.currentUser();

    this.editName.set(user?.name ?? '');
    this.tempAvatarUrl.set(user?.avatarUrl ?? null);

    if (user?.avatarUrl) {
      this.updateAccentFromImage(user.avatarUrl);
    } else {
      this.headerAccentColor.set(this.defaultTopColor);
    }

    this.isEditModalOpen.set(false);
  }

  /* ===================== */
  /* INPUTS */
  /* ===================== */
  onNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.editName.set(input.value);
  }

  onSelectPhoto(event: Event, fileInput: HTMLInputElement): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      this.tempAvatarUrl.set(result);

      if (result) {
        this.updateAccentFromImage(result);
      }

      fileInput.value = '';
    };

    reader.readAsDataURL(file);
  }

  removeSelectedPhoto(fileInput: HTMLInputElement): void {
    this.tempAvatarUrl.set(null);
    this.headerAccentColor.set(this.defaultTopColor);
    fileInput.value = '';
  }

  /* ===================== */
  /* NAVEGACIÓN */
  /* ===================== */
  goToPlaylistDetail(playlistId: string): void {
    if (!playlistId) return;
    this.router.navigate(['/user/playlist', playlistId]);
  }

  goToArtistDetail(artistId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!artistId) return;

    this.router.navigate(['/user/artist', artistId]);
  }

  /* ===================== */
  /* PLAYBACK */
  /* ===================== */
  playArtist(artistId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!artistId) return;

    const firstSong = this.songsCatalog()
      .filter(song => song.artistId === artistId)
      .sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))[0];

    if (!firstSong) return;

    const currentSong = this.playerState.currentSong();

    if (
      currentSong &&
      currentSong.artistId === artistId &&
      this.playerState.isPlaying()
    ) {
      this.playerState.pause();
      return;
    }

    if (
      currentSong &&
      currentSong.artistId === artistId &&
      !this.playerState.isPlaying()
    ) {
      this.playerState.resume();
      return;
    }

    this.playerState.playSong(firstSong);
  }

  isArtistPlaying(artistId: string): boolean {
    const currentSong = this.playerState.currentSong();
    return !!currentSong && currentSong.artistId === artistId && this.playerState.isPlaying();
  }

  /* ===================== */
  /* GUARDAR PERFIL */
  /* ===================== */
  saveProfile(): void {
    const user = this.currentUser();
    if (!user) return;

    const trimmedName = this.editName().trim();
    const nextName = trimmedName || user.name;
    const nextAvatarUrl = this.tempAvatarUrl();

    const updatedCurrentUser: CurrentUser = {
      ...user,
      name: nextName,
      avatarUrl: nextAvatarUrl,
    };

    this.persistAuthUser(updatedCurrentUser);
    this.persistAdminUser(updatedCurrentUser);
    this.authState.setCurrentUser(updatedCurrentUser);

    if (nextAvatarUrl) {
      this.updateAccentFromImage(nextAvatarUrl);
    } else {
      this.headerAccentColor.set(this.defaultTopColor);
    }

    this.isEditModalOpen.set(false);
  }

  /* ===================== */
  /* STORAGE SYNC */
  /* ===================== */
  private persistAuthUser(user: CurrentUser): void {
    try {
      const raw = localStorage.getItem(this.AUTH_USERS_KEY);
      const items: AuthUserStorageItem[] = raw ? JSON.parse(raw) : [];

      const updated = items.map(item =>
        item.id === user.id
          ? {
              ...item,
              name: user.name,
              avatarUrl: user.avatarUrl,
            }
          : item
      );

      localStorage.setItem(this.AUTH_USERS_KEY, JSON.stringify(updated));
    } catch {
      // noop
    }
  }

  private persistAdminUser(user: CurrentUser): void {
    try {
      const raw = localStorage.getItem(this.ADMIN_USERS_KEY);
      const items: AdminUserStorageItem[] = raw ? JSON.parse(raw) : [];

      const updated = items.map(item =>
        item.id === user.id
          ? {
              ...item,
              name: user.name,
              avatarUrl: user.avatarUrl ?? '',
            }
          : item
      );

      localStorage.setItem(this.ADMIN_USERS_KEY, JSON.stringify(updated));
    } catch {
      // noop
    }
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

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  /* ===================== */
  /* COLOR DOMINANTE */
  /* ===================== */
  private updateAccentFromImage(imageUrl: string): void {
    const image = new Image();
    image.crossOrigin = 'anonymous';

    image.onload = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        this.headerAccentColor.set(this.defaultTopColor);
        return;
      }

      const sampleWidth = 64;
      const sampleHeight = 64;

      canvas.width = sampleWidth;
      canvas.height = sampleHeight;

      context.drawImage(image, 0, 0, sampleWidth, sampleHeight);

      const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight);

      let red = 0;
      let green = 0;
      let blue = 0;
      let total = 0;

      for (let index = 0; index < data.length; index += 4) {
        const alpha = data[index + 3];
        if (alpha < 120) continue;

        red += data[index];
        green += data[index + 1];
        blue += data[index + 2];
        total++;
      }

      if (!total) {
        this.headerAccentColor.set(this.defaultTopColor);
        return;
      }

      const avgRed = Math.round(red / total);
      const avgGreen = Math.round(green / total);
      const avgBlue = Math.round(blue / total);

      const softened = this.softenRgb(avgRed, avgGreen, avgBlue);
      this.headerAccentColor.set(softened);
    };

    image.onerror = () => {
      this.headerAccentColor.set(this.defaultTopColor);
    };

    image.src = imageUrl;
  }

  private softenRgb(r: number, g: number, b: number): string {
    const soften = (value: number) => Math.min(255, Math.round(value * 0.72));
    return `rgb(${soften(r)}, ${soften(g)}, ${soften(b)})`;
  }
}