import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthToken } from '../../domain/models/auth-token.model';
import { RegisterPayload, User } from '../../domain/models/user.model';
import { API_GATEWAY_URL } from '../../../config/api-gateway-url.token';

@Injectable({ providedIn: 'root' })
export class AuthHttpService {
  private readonly http = inject(HttpClient);
  private readonly apiGatewayUrl = inject(API_GATEWAY_URL);

  private get baseUrl(): string {
    return `${this.apiGatewayUrl}/api/v1/auth`;
  }

  login(email: string, password: string): Observable<AuthToken> {
    return this.http.post<AuthToken>(`${this.baseUrl}/login`, { email, password, deviceInfo: navigator.userAgent });
  }

  loginWithGoogle(googleIdToken: string): Observable<AuthToken> {
    return this.http.post<AuthToken>(`${this.baseUrl}/login/google`, { googleIdToken, deviceInfo: navigator.userAgent });
  }

  register(payload: RegisterPayload): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/register`, payload);
  }

  verifyEmailOtp(email: string, code: string, type: 'REGISTER' | 'PASSWORD_RESET'): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/verify-email`, { email, code, type });
  }

  resendOtp(email: string, type: 'REGISTER' | 'PASSWORD_RESET'): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/resend-otp`, { email, type });
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/password/reset-request`, { email });
  }

  resetPassword(email: string, code: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/password/reset`, { email, code, newPassword });
  }

  logout(refreshToken: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout`, { refreshToken });
  }

  refreshToken(refreshToken: string): Observable<AuthToken> {
    return this.http.post<AuthToken>(`${this.baseUrl}/refresh`, { refreshToken });
  }
}
