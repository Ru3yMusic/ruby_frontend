import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthToken } from '../../domain/models/auth-token.model';
import { AuthRepositoryPort } from '../../domain/ports/auth.repository.port';
import { RegisterPayload, User } from '../../domain/models/user.model';
import { AuthHttpService } from '../http/auth-http.service';

@Injectable()
export class AuthApiAdapter extends AuthRepositoryPort {
  private readonly http = inject(AuthHttpService);

  login(email: string, password: string): Observable<AuthToken> {
    return this.http.login(email, password);
  }

  loginWithGoogle(googleIdToken: string): Observable<AuthToken> {
    return this.http.loginWithGoogle(googleIdToken);
  }

  register(payload: RegisterPayload): Observable<User> {
    return this.http.register(payload);
  }

  verifyEmailOtp(email: string, code: string, type: 'REGISTER' | 'PASSWORD_RESET'): Observable<void> {
    return this.http.verifyEmailOtp(email, code, type);
  }

  resendOtp(email: string, type: 'REGISTER' | 'PASSWORD_RESET'): Observable<void> {
    return this.http.resendOtp(email, type);
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.http.requestPasswordReset(email);
  }

  resetPassword(email: string, code: string, newPassword: string): Observable<void> {
    return this.http.resetPassword(email, code, newPassword);
  }

  logout(refreshToken: string): Observable<void> {
    return this.http.logout(refreshToken);
  }

  refreshToken(refreshToken: string): Observable<AuthToken> {
    return this.http.refreshToken(refreshToken);
  }
}
