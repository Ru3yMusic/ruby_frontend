import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'rm-playlist-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './playlist-card.component.html',
  styleUrl: './playlist-card.component.scss',
})
export class PlaylistCardComponent {
  coverUrl  = input<string | null>(null);
  title     = input.required<string>();
  subtitle  = input.required<string>();
  isPlaying = input(false);

  played   = output<void>();
  selected = output<void>();
}
