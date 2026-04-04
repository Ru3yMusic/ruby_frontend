import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LibraryState } from '../../state/library.state';

@Component({
  selector: 'rm-add-artists-success-page',
  standalone: true,
  templateUrl: './add-artists-success.page.html',
  styleUrl: './add-artists-success.page.scss',
})
export class AddArtistsSuccessPage {
  private readonly router = inject(Router);
  private readonly state = inject(LibraryState);

  readonly count = this.state.artists().length;

  finish(): void {
    this.router.navigate(['/library'], { queryParams: { tab: 'artists' } });
  }
}
