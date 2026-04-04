import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthRepositoryPort } from '../../domain/ports/auth.repository.port';

@Injectable({ providedIn: 'root' })
export class VerifyOtpUseCase {
  private readonly repo = inject(AuthRepositoryPort);

  execute(email: string, code: string, type: 'REGISTER' | 'PASSWORD_RESET'): Observable<void> {
    return this.repo.verifyEmailOtp(email, code, type);
  }

  resend(email: string, type: 'REGISTER' | 'PASSWORD_RESET'): Observable<void> {
    return this.repo.resendOtp(email, type);
  }
}
