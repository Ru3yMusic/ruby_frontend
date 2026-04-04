import { Component, input, output } from '@angular/core';

@Component({
  selector: 'rm-gender-chip',
  standalone: true,
  templateUrl: './gender-chip.component.html',
  styleUrl: './gender-chip.component.scss',
})
export class GenderChipComponent {
  label    = input.required<string>();
  selected = input(false);
  toggled  = output<void>();
}
