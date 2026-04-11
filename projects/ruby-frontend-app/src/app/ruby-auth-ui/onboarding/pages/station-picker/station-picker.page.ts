import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthState } from '../../../auth/state/auth.state';

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
  private authState = inject(AuthState);

  // Lista base de estaciones cargadas desde localStorage
  stations = signal<StationUI[]>([]);

  // Texto del buscador
  searchTerm = signal('');

  // Lista filtrada para mostrar en la UI
  filteredStations = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();

    if (!term) {
      return this.stations();
    }

    return this.stations().filter(station =>
      station.name.toLowerCase().includes(term)
    );
  });

  // Selección actual de estaciones
  selectedIds = signal<string[]>([]);

  // Error visual si no selecciona mínimo 3
  showError = signal(false);

  constructor() {
    this.loadStations();
  }

  // =========================
  // CARGAR ESTACIONES DESDE LOCALSTORAGE
  // =========================
  private loadStations(): void {
    const raw = localStorage.getItem('ruby_stations');

    if (!raw) {
      console.warn('No hay estaciones en localStorage');
      this.stations.set([]);
      return;
    }

    try {
      const parsed = JSON.parse(raw);

      const mapped: StationUI[] = parsed.map((station: any) => ({
        id: station.id,
        name: station.name,
        gradientStart: station.gradientStart,
        gradientEnd: station.gradientEnd,
      }));

      this.stations.set(mapped);
    } catch (error) {
      console.error('Error leyendo estaciones', error);
      this.stations.set([]);
    }
  }

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
  console.log('Stations seleccionadas:', this.selectedIds());

  window.location.href = '/onboarding/complete';
}
}