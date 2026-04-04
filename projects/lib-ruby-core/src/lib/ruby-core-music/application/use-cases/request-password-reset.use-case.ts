import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthRepositoryPort } from '../../domain/ports/auth.repository.port';

@Injectable({ providedIn: 'root' })
export class RequestPasswordResetUseCase {
  private readonly repo = inject(AuthRepositoryPort);

  execute(email: string): Observable<void> {
    return this.repo.requestPasswordReset(email);
  }

  resetPassword(email: string, code: string, newPassword: string): Observable<void> {
    return this.repo.resetPassword(email, code, newPassword);
  }
}
