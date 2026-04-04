import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import {
  LucideAngularModule,
  ChevronDown, EllipsisVertical, Heart,
  Shuffle, SkipBack, Play, SkipForward, Share2,
} from 'lucide-angular';
import { TrackItem, ALL_TRACKS } from '../../state/tracks-mock.data';

@Component({
  selector: 'rm-music-player-page',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './music-player.page.html',
  styleUrl: './music-player.page.scss',
})
export class MusicPlayerPage {
  private readonly route = inject(ActivatedRoute);

  readonly showLyrics       = signal(false);
  readonly ChevronDown      = ChevronDown;
  readonly EllipsisVertical = EllipsisVertical;
  readonly Heart            = Heart;
  readonly Shuffle          = Shuffle;
  readonly SkipBack         = SkipBack;
  readonly Play             = Play;
  readonly SkipForward      = SkipForward;
  readonly Share2           = Share2;

  readonly track: TrackItem;

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.track = ALL_TRACKS.find(t => t.id === id) ?? ALL_TRACKS[0];
  }

  toggleLyrics(): void {
    this.showLyrics.update(v => !v);
  }
}
