import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent, OnboardingTemplateComponent, StationBubbleComponent } from 'lib-ruby-core-ui';
import { LucideAngularModule, Search } from 'lucide-angular';

interface Station { id: string; name: string; gradient: string; }

const ALL_STATIONS: Station[] = [
  { id: 'rock',     name: 'Rock',     gradient: 'linear-gradient(135deg, #8B4513, #D2691E)' },
  { id: 'pop',      name: 'Pop',      gradient: 'linear-gradient(135deg, #FF8C00, #FFD700)' },
  { id: 'plug',     name: 'Plug',     gradient: 'linear-gradient(135deg, #8B0057, #C71585)' },
  { id: 'salsa',    name: 'Salsa',    gradient: 'linear-gradient(135deg, #4B0082, #8A2BE2)' },
  { id: 'baladas',  name: 'Baladas',  gradient: 'linear-gradient(135deg, #8B0000, #DC143C)' },
  { id: 'hiphop',   name: 'Hip-Hop',  gradient: 'linear-gradient(135deg, #008080, #20B2AA)' },
  { id: 'regueton', name: 'Reguetón', gradient: 'linear-gradient(135deg, #2F0040, #6A0080)' },
  { id: 'trap',     name: 'Trap',     gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)' },
  { id: 'bachata',  name: 'Bachata',  gradient: 'linear-gradient(135deg, #C71585, #FF69B4)' },
];

@Component({
  selector: 'rm-station-picker',
  standalone: true,
  imports: [FormsModule, OnboardingTemplateComponent, StationBubbleComponent, ButtonComponent, LucideAngularModule],
  templateUrl: './station-picker.page.html',
  styleUrl: './station-picker.page.scss',
})
export class StationPickerPage {
  private router = inject(Router);
  readonly Search = Search;

  searchQuery = '';
  selected    = signal<Set<string>>(new Set());

  filteredStations = computed(() =>
    ALL_STATIONS.filter(s =>
      s.name.toLowerCase().includes(this.searchQuery.toLowerCase())
    )
  );

  isSelected(id: string): boolean { return this.selected().has(id); }

  toggle(id: string): void {
    this.selected.update(set => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  onListo(): void {
    this.router.navigate(['/onboarding/complete']);
  }
}
