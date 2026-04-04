import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LibraryState } from '../../state/library.state';

@Component({
  selector: 'rm-add-albums-success-page',
  standalone: true,
  templateUrl: './add-albums-success.page.html',
  styleUrl: './add-albums-success.page.scss',
})
export class AddAlbumsSuccessPage {
  private readonly router = inject(Router);
  private readonly state = inject(LibraryState);

  readonly count = this.state.albums().length;

  finish(): void {
    this.router.navigate(['/library']);
  }
}
