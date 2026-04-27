import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthState, CurrentUser } from '../../../auth/state/auth.state';
import { LibraryState } from '../../../../user-ruby-music/state/library.state';
import { InteractionState } from '../../../../user-ruby-music/state/interaction.state';
import { PlayerState } from '../../../../user-ruby-music/state/player.state';
import { PreferencesApi } from 'lib-ruby-sdks/interaction-service';

interface StationUI {
  id: string;
  name: string;
  photoUrl: string | null;
}

@Component({
  selector: 'app-onboarding-complete-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './onboarding-complete.page.html',
  styleUrl: './onboarding-complete.page.scss',
})
export class OnboardingCompletePage implements OnInit {
  private readonly authState = inject(AuthState);
  private readonly libraryState = inject(LibraryState);
  private readonly interactionState = inject(InteractionState);
  private readonly playerState = inject(PlayerState);
  private readonly preferencesApi = inject(PreferencesApi);
  private readonly router = inject(Router);

  // IDs seleccionados en el step anterior
  readonly selectedArtistIds = this.authState.selectedArtists;

  // Artistas seleccionados completos para mostrar en pantalla
  readonly selectedStations = computed<StationUI[]>(() => {
    const ids = this.selectedArtistIds();
    return this.libraryState.artists()
      .filter(artist => ids.includes((artist as any).id))
      .map(artist => this.toStationUI(artist));
  });

  constructor() {
    this.persistOnboardingProgress();
  }

  ngOnInit(): void {
    // Si llegamos aquí tras un full-reload, artists() puede estar vacío.
    if (this.libraryState.artists().length === 0) {
      this.libraryState.loadArtists();
    }
  }

  // =========================
  // PERSISTIR ONBOARDING COMPLETADO
  // =========================
  private persistOnboardingProgress(): void {
    const currentUser = this.authState.currentUser();
    if (!currentUser) return;

    const artistIds = this.selectedArtistIds();

    const updatedCurrentUser: CurrentUser = {
      ...currentUser,
      onboardingCompleted: true,
      selectedArtistIds: artistIds,
    };

    this.authState.setCurrentUser(updatedCurrentUser);
    // Persistir flag por userId para que sobreviva al logout.
    this.authState.markOnboardingCompleted(currentUser.id, artistIds);
    this.preferencesApi.saveArtistPreferences({ ids: artistIds }).subscribe({
      error: () => {
        // Keep onboarding UX non-blocking if preferences API fails.
      },
    });
    this.syncSelectedArtistsToLibrary(artistIds);
  }

  private syncSelectedArtistsToLibrary(artistIds: string[]): void {
    const uniqueIds = Array.from(new Set(artistIds.filter(Boolean)));
    for (const artistId of uniqueIds) {
      if (this.interactionState.isArtistInLibrary(artistId)) continue;
      this.interactionState.addArtistToLibrary(artistId);
    }
  }

  // =========================
  // ESCUCHAR AHORA
  // Reproduce una canción aleatoria de los artistas elegidos
  // =========================
  listenNow(): void {
    const artistIds = this.selectedArtistIds().length > 0
      ? this.selectedArtistIds()
      : this.selectedStations().map(s => s.id);

    if (artistIds.length === 0) {
      this.router.navigateByUrl('/user/home');
      return;
    }

    const requests = artistIds.map((artistId) =>
      this.libraryState.getArtistSongs(artistId).pipe(catchError(() => of([]))),
    );

    forkJoin(requests).subscribe((songGroups) => {
      const songs = songGroups
        .flat()
        .filter((song) => !!song?.id && !!song?.audioUrl && Number(song.duration ?? 0) > 0);

      if (!songs.length) {
        this.router.navigateByUrl('/user/home');
        return;
      }

      // Build a randomised queue from ALL songs of the chosen artists so
      // footer prev/next navigates within the seeded queue, and the auto-next
      // logic (PlayerState.advanceOnEnded) keeps the music going. Picking a
      // random startIndex guarantees we don't always boot with the same
      // first track of the first chosen artist.
      const shuffled = this.shuffle(songs);
      const startIndex = Math.floor(Math.random() * shuffled.length);
      this.playerState.playQueue(shuffled, startIndex);
      this.router.navigateByUrl('/user/home');
    });
  }

  // =========================
  // AHORA NO
  // Va directo al home
  // =========================
  skip(): void {
    this.router.navigateByUrl('/user/home');
  }

  // =========================
  // HELPERS
  // =========================
  private toStationUI(station: any): StationUI {
    return {
      id: station.id,
      name: station.name,
      photoUrl: station.photoUrl ?? null,
    };
  }

  private shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}
