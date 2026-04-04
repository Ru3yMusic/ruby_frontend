import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'rm-progress-dots',
  standalone: true,
  templateUrl: './progress-dots.component.html',
  styleUrl: './progress-dots.component.scss',
})
export class ProgressDotsComponent {
  total   = input(5);
  current = input(1);

  steps = computed(() =>
    Array.from({ length: this.total() }, (_, i) => i + 1)
  );
}
