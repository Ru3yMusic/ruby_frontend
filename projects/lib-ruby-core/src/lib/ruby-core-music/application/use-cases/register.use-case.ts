import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RegisterPayload, User } from '../../domain/models/user.model';
import { AuthRepositoryPort } from '../../domain/ports/auth.repository.port';

@Injectable({ providedIn: 'root' })
export class RegisterUseCase {
  private readonly repo = inject(AuthRepositoryPort);

  execute(payload: RegisterPayload): Observable<User> {
    return this.repo.register(payload);
  }
}
