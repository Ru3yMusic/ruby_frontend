import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthToken } from '../../domain/models/auth-token.model';
import { AuthRepositoryPort } from '../../domain/ports/auth.repository.port';

@Injectable({ providedIn: 'root' })
export class LoginUseCase {
  private readonly repo = inject(AuthRepositoryPort);

  execute(email: string, password: string): Observable<AuthToken> {
    return this.repo.login(email, password);
  }
}
