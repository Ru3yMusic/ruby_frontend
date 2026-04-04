import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StationBubbleComponent } from '../../molecules/station-bubble/station-bubble.component';
import { ButtonComponent } from '../../atoms/button/button.component';
import { LucideAngularModule, Search } from 'lucide-angular';

export interface Station {
  id:       string;
  name:     string;
  gradient: string;
}

@Component({
  selector: 'rm-station-grid',
  standalone: true,
  imports: [FormsModule, StationBubbleComponent, ButtonComponent, LucideAngularModule],
  templateUrl: './station-grid.component.html',
  styleUrl: './station-grid.component.scss',
})
export class StationGridComponent {
  // ── Inputs from page ──────────────────────────────────────────────────
  stations    = input.required<Station[]>();
  minSelected = input(3);

  // ── Events to page ────────────────────────────────────────────────────
  confirmed = output<string[]>(); // array of selected station IDs
  readonly Search = Search;

  // ── Internal state ────────────────────────────────────────────────────
  searchQuery = '';
  private selected = signal<Set<string>>(new Set());

  filteredStations = computed(() =>
    this.stations().filter(s =>
      s.name.toLowerCase().includes(this.searchQuery.toLowerCase())
    )
  );

  selectionCount = computed(() => this.selected().size);
  canConfirm     = computed(() => this.selected().size >= this.minSelected());

  isSelected(id: string): boolean { return this.selected().has(id); }

  toggle(id: string): void {
    this.selected.update(set => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  onConfirm(): void {
    this.confirmed.emit([...this.selected()]);
  }
}
