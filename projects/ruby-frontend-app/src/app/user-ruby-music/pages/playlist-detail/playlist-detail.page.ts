import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Lock, Upload, Shuffle, Play, Image, Camera,
  Plus, ChevronLeft, House, Search, Library,
} from 'lucide-angular';
import { PlaylistState, PlaylistTrack } from '../../state/playlist.state';

@Component({
  selector: 'rm-playlist-detail-page',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './playlist-detail.page.html',
  styleUrl: './playlist-detail.page.scss',
})
export class PlaylistDetailPage {
  readonly Lock        = Lock;
  readonly Upload      = Upload;
  readonly Shuffle     = Shuffle;
  readonly Play        = Play;
  readonly Image       = Image;
  readonly Camera      = Camera;
  readonly Plus        = Plus;
  readonly ChevronLeft = ChevronLeft;
  readonly House       = House;
  readonly Search      = Search;
  readonly Library     = Library;
  private readonly router = inject(Router);
  readonly state = inject(PlaylistState);

  readonly playlist = computed(() => this.state.playlist());
  readonly hasTracks = computed(() => (this.state.playlist()?.tracks.length ?? 0) > 0);
  readonly isPrivate = computed(() => this.state.playlist()?.isPrivate ?? false);
  readonly menuOpen = signal(false);
  readonly deleteConfirmOpen = signal(false);
  readonly toast = signal('');

  // Editar portada
  readonly editPortadaOpen = signal(false);
  readonly editTitle = signal('');
  readonly editDescription = signal('');
  readonly editCoverPreview = signal<string | null>(null);

  goAdd(): void {
    const playlist = this.playlist();
    if (!playlist) return;
    this.router.navigate(['/library/playlist', playlist.id, 'add']);
  }

  goEdit(): void {
    const playlist = this.playlist();
    if (!playlist) return;
    this.menuOpen.set(false);
    this.router.navigate(['/library/playlist', playlist.id, 'edit']);
  }

  addRecommendation(track: PlaylistTrack): void {
    this.state.addTracks([track.id]);
    this.showToast(`"${track.title}" agregada a la playlist`);
  }

  togglePrivacy(): void {
    this.state.togglePrivacy();
    this.menuOpen.set(false);
    this.showToast(this.isPrivate() ? 'Playlist ahora es privada' : 'Playlist ahora es pública');
  }

  confirmDeletePlaylist(): void {
    this.menuOpen.set(false);
    this.deleteConfirmOpen.set(true);
  }

  deletePlaylist(): void {
    this.deleteConfirmOpen.set(false);
    this.state.playlist.set(null);
    this.router.navigate(['/library']);
  }

  openEditPortada(): void {
    const p = this.playlist();
    this.editTitle.set(p?.name ?? '');
    this.editDescription.set(p?.description ?? '');
    this.editCoverPreview.set(p?.coverUrl ?? null);
    this.menuOpen.set(false);
    this.editPortadaOpen.set(true);
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => this.editCoverPreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  savePortada(): void {
    this.state.updateMeta({
      name: this.editTitle().trim() || this.playlist()?.name,
      description: this.editDescription().trim(),
      coverUrl: this.editCoverPreview() ?? undefined,
    });
    this.editPortadaOpen.set(false);
    this.showToast('Portada actualizada');
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 2500);
  }
}
