import { Component, input, output, ViewChild } from '@angular/core';
import { OtpInputGroupComponent } from '../../atoms/otp-input-group/otp-input-group.component';
import { ButtonComponent } from '../../atoms/button/button.component';

@Component({
  selector: 'rm-otp-verify-form',
  standalone: true,
  imports: [OtpInputGroupComponent, ButtonComponent],
  templateUrl: './otp-verify-form.component.html',
  styleUrl: './otp-verify-form.component.scss',
})
export class OtpVerifyFormComponent {
  @ViewChild(OtpInputGroupComponent) otpGroup!: OtpInputGroupComponent;

  // ── Inputs from page ──────────────────────────────────────────────────
  email       = input.required<string>();
  loading     = input(false);
  serverError = input('');

  // ── Events to page ────────────────────────────────────────────────────
  codeEntered = output<string>();
  resendClicked = output<void>();

  protected pendingCode = '';

  onCodeComplete(code: string): void {
    this.pendingCode = code;
  }

  onVerify(): void {
    if (this.pendingCode) this.codeEntered.emit(this.pendingCode);
  }

  reset(): void {
    this.pendingCode = '';
    this.otpGroup?.reset();
  }
}
