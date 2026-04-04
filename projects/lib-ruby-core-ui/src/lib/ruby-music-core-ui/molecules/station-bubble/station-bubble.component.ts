import { Component, input, output } from '@angular/core';

@Component({
  selector: 'rm-station-bubble',
  standalone: true,
  templateUrl: './station-bubble.component.html',
  styleUrl: './station-bubble.component.scss',
})
export class StationBubbleComponent {
  name     = input.required<string>();
  gradient = input.required<string>();
  selected = input(false);
  toggled  = output<void>();
}
