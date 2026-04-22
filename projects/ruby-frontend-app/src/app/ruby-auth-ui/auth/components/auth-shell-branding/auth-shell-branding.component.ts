import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';

/**
 * Left-side branding panel with a 3-slide auto-rotating hero. Each slide has
 * its own typographic composition (impact / poetic / intimate) so the whole
 * sequence feels editorial rather than a generic carousel. The only logic
 * here is the 5-second tick — everything else is structural CSS and template.
 */
@Component({
  selector: 'app-auth-shell-branding',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auth-shell-branding.component.html',
  styleUrl: './auth-shell-branding.component.scss',
})
export class AuthShellBrandingComponent {
  private static readonly TOTAL_SLIDES = 3;
  private static readonly SLIDE_DURATION_MS = 5000;

  /** Index of the currently visible slide — the template binds `.active`
   *  on both the slide itself and the matching dot indicator. */
  readonly currentSlide = signal(0);

  constructor() {
    const intervalId = setInterval(() => {
      this.currentSlide.update(
        (n) => (n + 1) % AuthShellBrandingComponent.TOTAL_SLIDES,
      );
    }, AuthShellBrandingComponent.SLIDE_DURATION_MS);

    // Clean up on component destroy so we don't leave a rogue timer running
    // (and mutating a signal after the component is gone).
    inject(DestroyRef).onDestroy(() => clearInterval(intervalId));
  }
}
