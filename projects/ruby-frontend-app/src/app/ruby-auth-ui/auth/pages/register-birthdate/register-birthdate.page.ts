import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthTemplateComponent, ButtonComponent, DateWheelPickerComponent } from 'lib-ruby-core-ui';
import { AuthState } from '../../state/auth.state';

@Component({
  selector: 'rm-register-birthdate',
  standalone: true,
  imports: [AuthTemplateComponent, DateWheelPickerComponent, ButtonComponent],
  templateUrl: './register-birthdate.page.html',
  styleUrl: './register-birthdate.page.scss',
})
export class RegisterBirthdatePage {
  private readonly authState = inject(AuthState);
  private readonly router    = inject(Router);

  private selectedDate = signal('');

  onDateChange(date: string): void { this.selectedDate.set(date); }

  onContinue(): void {
    this.authState.patchDraft({ birthDate: this.selectedDate() });
    this.router.navigate(['/auth/register/gender']);
  }
}
