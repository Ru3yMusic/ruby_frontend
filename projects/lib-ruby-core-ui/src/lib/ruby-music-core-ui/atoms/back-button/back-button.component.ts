import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { LucideAngularModule, ChevronLeft } from 'lucide-angular';

@Component({
  selector: 'rm-back-button',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './back-button.component.html',
  styleUrl: './back-button.component.scss',
})
export class BackButtonComponent {
  readonly ChevronLeft = ChevronLeft;
  private readonly location = inject(Location);

  go(): void {
    this.location.back();
  }
}
