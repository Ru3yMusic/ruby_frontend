import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthState } from '../../../auth/state/auth.state';
import { LibraryState } from '../../../../user-ruby-music/state/library.state';

interface StationUI {
  id: string;
  name: string;
  gradientStart: string;
  gradientEnd: string;
}

@Component({
  selector: 'app-station-picker-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './station-picker.page.html',
  styleUrl: './station-picker.page.scss',
})
export class StationPickerPage {
  private readonly authState = inject(AuthState);
  private readonly libraryState = inject(LibraryState);

  searchTerm = signal('');
  selectedIds = signal<string[]>([]);
  showError = signal(false);

  filteredStations = computed<StationUI[]>(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const stations = this.libraryState.stations().map(s => this.toStationUI(s));

    if (!term) return stations;
    return stations.filter(station => station.name.toLowerCase().includes(term));
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

    this.authState.setStations(this.selectedIds());
    window.location.href = '/onboarding/complete';
  }

  // =========================
  // HELPERS
  // =========================
  private toStationUI(station: any): StationUI {
    return {
      id: station.id,
      name: station.name,
      gradientStart: station.gradientStart ?? '#1a1a2e',
      gradientEnd: station.gradientEnd ?? '#16213e',
    };
  }
}
