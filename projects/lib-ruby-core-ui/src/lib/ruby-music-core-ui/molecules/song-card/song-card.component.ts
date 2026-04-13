import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'rm-song-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './song-card.component.html',
  styleUrl: './song-card.component.scss',
})
export class SongCardComponent {
  coverUrl  = input<string>('');
  title     = input.required<string>();
  artistName = input.required<string>();
  isPlaying  = input(false);
  isLiked    = input(false);

  played = output<void>();
  liked  = output<void>();
}
