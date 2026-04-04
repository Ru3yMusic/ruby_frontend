import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlaylistState } from '../../state/playlist.state';

@Component({
  selector: 'rm-playlist-create-page',
  standalone: true,
  templateUrl: './playlist-create.page.html',
  styleUrl: './playlist-create.page.scss',
})
export class PlaylistCreatePage {
  private readonly router = inject(Router);
  private readonly playlistState = inject(PlaylistState);

  readonly name = signal('Para dormir');

  cancel(): void {
    this.router.navigate(['/library']);
  }

  create(): void {
    const created = this.playlistState.createPlaylist(this.name().trim() || 'Nueva playlist');
    this.router.navigate(['/library/playlist', created.id]);
  }
}
