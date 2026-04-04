import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PlaylistState, PlaylistTrack } from '../../state/playlist.state';

@Component({
  selector: 'rm-playlist-edit-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './playlist-edit.page.html',
  styleUrl: './playlist-edit.page.scss',
})
export class PlaylistEditPage {
  private readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);
  readonly state = inject(PlaylistState);

  readonly localTracks = signal<PlaylistTrack[]>([...(this.state.playlist()?.tracks ?? [])]);

  private get playlistId(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  moveUp(trackId: string): void {
    this.localTracks.update(list => {
      const index = list.findIndex(t => t.id === trackId);
      if (index <= 0) return list;
      const next = [...list];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  moveDown(trackId: string): void {
    this.localTracks.update(list => {
      const index = list.findIndex(t => t.id === trackId);
      if (index === -1 || index >= list.length - 1) return list;
      const next = [...list];
      [next[index + 1], next[index]] = [next[index], next[index + 1]];
      return next;
    });
  }

  save(): void {
    this.state.reorderTracks(this.localTracks().map(t => t.id));
    this.router.navigate(['/library/playlist', this.playlistId]);
  }
}
