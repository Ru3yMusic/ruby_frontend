import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthRepositoryPort } from 'lib-ruby-core';
import { AuthState, CurrentUser } from '../../../ruby-auth-ui/auth/state/auth.state';
import { TokenStorageService } from '../../../core/services/token-storage.service';
import { PlaylistResponse } from 'lib-ruby-sdks/playlist-service';
import { InteractionState } from '../../state/interaction.state';
import { LibraryState } from '../../state/library.state';
import { PlaylistState } from '../../state/playlist.state';
import { PlayerState } from '../../state/player.state';
import { UserProfileState } from '../../state/user-profile.state';

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
  private readonly libraryState = inject(LibraryState);
  private readonly interactionState = inject(InteractionState);
  private readonly authRepo = inject(AuthRepositoryPort);
  private readonly tokenStorage = inject(TokenStorageService);
  readonly userProfileState = inject(UserProfileState);

  private readonly defaultTopColor = '#5b5b5b';
  private readonly defaultAvatar = '/assets/icons/avatar-placeholder.png';

  readonly currentUser = this.authState.currentUser;

  readonly isEditModalOpen = signal(false);
  readonly isAvatarHovered = signal(false);

  readonly editName = signal('');
  readonly tempAvatarUrl = signal<string | null>(null);
  readonly headerAccentColor = signal(this.defaultTopColor);

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
        playlist => !(playlist.isSystem === true)
      );

    return playlists.map((playlist: PlaylistResponse) => ({
      id: playlist.id!,
      title: playlist.name!,
      coverUrl: playlist.coverUrl ?? null,
      ownerName: user.name,
      isPublic: playlist.isPublic === true,
      songsCount: playlist.songCount ?? 0,
      isLikedSongs: playlist.isSystem === true,
    }));
  });

  readonly followedArtists = computed<FollowedArtistCard[]>(() => {
    const followedArtistIds = this.interactionState.allFollowedArtistIds();

    return followedArtistIds
      .map(artistId => (this.libraryState.artists() as any[]).find((artist: any) => artist.id === artistId) ?? null)
      .filter((artist): artist is any => !!artist)
      .map((artist: any) => ({
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
      this.playlistState.loadPlaylists();
      this.userProfileState.loadProfile(user.id);
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

    const firstSong = (this.libraryState.songs() as any[])
      .filter((song: any) => song.artistId === artistId)
      .sort((a: any, b: any) => (b.playCount ?? 0) - (a.playCount ?? 0))[0];

    if (!firstSong) return;

    const currentSong = this.playerState.currentSong();

    if (
      currentSong &&
      (currentSong as any).artistId === artistId &&
      this.playerState.isPlaying()
    ) {
      this.playerState.pause();
      return;
    }

    if (
      currentSong &&
      (currentSong as any).artistId === artistId &&
      !this.playerState.isPlaying()
    ) {
      this.playerState.resume();
      return;
    }

    this.playerState.playSong(firstSong as any);
  }

  isArtistPlaying(artistId: string): boolean {
    const currentSong = this.playerState.currentSong();
    return !!currentSong && (currentSong as any).artistId === artistId && this.playerState.isPlaying();
  }

  /* ===================== */
  /* GUARDAR PERFIL */
  /* ===================== */
  saveProfile(): void {
    const user = this.currentUser();
    if (!user || !user.id) {
      this.userProfileState.clearError();
      return;
    }

    const trimmedName = this.editName().trim();
    const nextName = trimmedName || user.name;
    const nextAvatarUrl = this.tempAvatarUrl();

    this.userProfileState
      .updateProfile(user.id, {
        displayName: nextName,
        profilePhotoUrl: nextAvatarUrl ?? undefined,
      })
      .subscribe({
        next: (updatedUser) => {
          // Sync AuthState so the nav avatar and display name update immediately
          const syncedUser: CurrentUser = {
            ...user,
            name: updatedUser.displayName ?? nextName,
            avatarUrl: updatedUser.profilePhotoUrl ?? nextAvatarUrl,
          };
          this.authState.setCurrentUser(syncedUser);

          const avatarToShow = syncedUser.avatarUrl;
          if (avatarToShow) {
            this.updateAccentFromImage(avatarToShow);
          } else {
            this.headerAccentColor.set(this.defaultTopColor);
          }

          // Re-issue the JWT so the new displayName reaches realtime-ws-ms.
          // The effect in NotificationsState watches tokenStorage.accessToken()
          // and will reconnect the socket with the fresh token automatically,
          // which refreshes socket.data.username on the server side. Any future
          // comment / chat message now carries the updated name.
          this.refreshJwtAfterProfileUpdate();

          this.isEditModalOpen.set(false);
        },
        error: () => {
          // El error queda en userProfileState.error() — se muestra en el modal.
          // El modal permanece abierto para que el usuario pueda reintentar.
        },
      });
  }

  private refreshJwtAfterProfileUpdate(): void {
    const refreshToken = this.tokenStorage.getRefreshToken();
    if (!refreshToken) return;

    this.authRepo.refreshToken(refreshToken).subscribe({
      next: (authToken) => {
        this.tokenStorage.setTokens(authToken.accessToken, authToken.refreshToken);
      },
      error: () => {
        // Non-fatal: UI already reflects new name; WS will carry the old name
        // until the next natural reconnect (page reload, token expiry, etc.).
      },
    });
  }

  /* ===================== */
  /* HELPERS */
  /* ===================== */
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
