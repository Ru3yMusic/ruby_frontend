import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PlaylistState } from '../../state/playlist.state';

type SourceTab = 'sugerencias' | 'me-gusta';

@Component({
  selector: 'rm-playlist-add-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './playlist-add.page.html',
  styleUrl: './playlist-add.page.scss',
})
export class PlaylistAddPage {
  private readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);
  readonly state = inject(PlaylistState);

  readonly tab = signal<SourceTab>('sugerencias');
  readonly selectedIds = signal<Record<string, boolean>>({});
  readonly search = signal('');
  readonly toast = signal('');

  private get playlistId(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  readonly list = computed(() => {
    const base = this.tab() === 'sugerencias' ? this.state.recommendations() : this.state.liked();
    const q = this.search().trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q),
    );
  });

  toggle(id: string): void {
    this.selectedIds.update(s => ({ ...s, [id]: !s[id] }));
  }

  save(): void {
    const ids = Object.entries(this.selectedIds())
      .filter(([, v]) => v)
      .map(([id]) => id);
    this.state.addTracks(ids);
    this.toast.set('Canciones agregadas a la playlist.');
    setTimeout(() => this.router.navigate(['/library/playlist', this.playlistId]), 900);
  }
}
