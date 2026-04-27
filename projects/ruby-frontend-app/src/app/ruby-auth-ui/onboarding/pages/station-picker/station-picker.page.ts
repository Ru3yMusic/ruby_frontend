import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthState } from '../../../auth/state/auth.state';
import { LibraryState } from '../../../../user-ruby-music/state/library.state';

interface StationUI {
  id: string;
  name: string;
  photoUrl: string | null;
}

@Component({
  selector: 'app-station-picker-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './station-picker.page.html',
  styleUrl: './station-picker.page.scss',
})
export class StationPickerPage implements OnInit {
  private readonly authState = inject(AuthState);
  private readonly libraryState = inject(LibraryState);
  private readonly router = inject(Router);

  searchTerm = signal('');
  selectedIds = signal<string[]>([]);
  showError = signal(false);

  ngOnInit(): void {
    this.libraryState.loadArtists();
  }

  filteredStations = computed<StationUI[]>(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const artists = this.libraryState.artists().map(s => this.toStationUI(s));

    if (!term) return artists;
    return artists.filter(artist => artist.name.toLowerCase().includes(term));
  });

  // =========================
  // BUSCADOR
  // =========================
  onSearch(value: string): void {
    this.searchTerm.set(value);
  }

  // =========================
  // SELECCIÓN DE ESTACIONES
  // =========================
  toggleStation(id: string): void {
    const current = this.selectedIds();

    if (current.includes(id)) {
      this.selectedIds.set(current.filter(selectedId => selectedId !== id));
      return;
    }

    this.selectedIds.set([...current, id]);
    this.showError.set(false);
  }

  isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  // =========================
  // CONTINUAR
  // =========================
  continue(): void {
    if (this.selectedIds().length < 3) {
      this.showError.set(true);
      return;
    }

    this.authState.setArtists(this.selectedIds());
    this.router.navigateByUrl('/onboarding/complete');
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
}
