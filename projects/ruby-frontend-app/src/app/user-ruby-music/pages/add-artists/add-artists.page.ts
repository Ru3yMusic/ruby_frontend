import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LibraryArtist, LibraryState } from '../../state/library.state';

@Component({
  selector: 'rm-add-artists-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './add-artists.page.html',
  styleUrl: './add-artists.page.scss',
})
export class AddArtistsPage {
  private readonly router = inject(Router);
  private readonly state = inject(LibraryState);

  readonly query = signal('');
  readonly selected = signal<Record<string, boolean>>({});

  readonly suggestions: LibraryArtist[] = [
    { id: 'lana', name: 'Lana del rey', image: 'L' },
    { id: 'central', name: 'Central Cee', image: 'C' },
    { id: 'joji', name: 'Joji', image: 'J' },
    { id: 'gustavo', name: 'Gustavo Cerati', image: 'G' },
    { id: 'cro', name: 'C.R.O', image: 'R' },
    { id: 'billie', name: 'Billie Eilish', image: 'B' },
    { id: 'manuel', name: 'Manuel Medrano', image: 'M' },
    { id: 'sade', name: 'Sade', image: 'S' },
    { id: 'weeknd', name: 'The Weeknd', image: 'W' },
  ];

  readonly selectedArtists = computed(() =>
    this.suggestions.filter(a => this.selected()[a.id]),
  );

  toggle(id: string): void {
    this.selected.update(s => ({ ...s, [id]: !s[id] }));
  }

  complete(): void {
    const artists = this.selectedArtists();
    if (artists.length === 0) return;
    this.state.addArtists(artists);
    this.router.navigate(['/library/add-artists/success']);
  }
}
