import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthToken } from '../../domain/models/auth-token.model';
import { AuthRepositoryPort } from '../../domain/ports/auth.repository.port';
import { RegisterPayload, User } from '../../domain/models/user.model';
import {
  AuthenticationApi,
  PasswordApi,
  RegistrationApi,
  RegisterRequest as SdkRegisterRequest,
  TokenResponse,
  UserResponse,
} from 'lib-ruby-sdks/auth-service';

@Injectable()
export class AuthApiAdapter extends AuthRepositoryPort {
  private readonly authApi = inject(AuthenticationApi);
  private readonly registrationApi = inject(RegistrationApi);
  private readonly passwordApi = inject(PasswordApi);

  login(email: string, password: string): Observable<AuthToken> {
    return this.authApi
      .login({ email, password, deviceInfo: navigator.userAgent })
      .pipe(map(res => this.toAuthToken(res)));
  }

  loginWithGoogle(googleIdToken: string): Observable<AuthToken> {
    return this.authApi
      .loginWithGoogle({ googleIdToken, deviceInfo: navigator.userAgent })
      .pipe(map(res => this.toAuthToken(res)));
  }

  register(payload: RegisterPayload): Observable<User> {
    return this.registrationApi
      .register(payload as unknown as SdkRegisterRequest)
      .pipe(map(res => this.toUser(res)));
  }

  verifyEmailOtp(email: string, code: string, type: 'REGISTER' | 'PASSWORD_RESET'): Observable<void> {
    return this.registrationApi.verifyEmail({ email, code, type });
  }

  resendOtp(email: string, type: 'REGISTER' | 'PASSWORD_RESET'): Observable<void> {
    return this.registrationApi.resendOtp({ email, type });
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.passwordApi.requestPasswordReset({ email });
  }

  resetPassword(email: string, code: string, newPassword: string): Observable<void> {
    return this.passwordApi.resetPassword({ email, code, newPassword });
  }

  logout(refreshToken: string): Observable<void> {
    return this.authApi.logout({ refreshToken });
  }

  refreshToken(refreshToken: string): Observable<AuthToken> {
    return this.authApi
      .refreshToken({ refreshToken })
      .pipe(map(res => this.toAuthToken(res)));
  }

  private toAuthToken(res: TokenResponse): AuthToken {
    return {
      accessToken: res.accessToken ?? '',
      refreshToken: res.refreshToken ?? '',
      tokenType: res.tokenType ?? 'Bearer',
      expiresIn: res.expiresIn ?? 0,
    };
  }

  private toUser(res: UserResponse): User {
    return {
      id: res.id ?? '',
      email: res.email ?? '',
      displayName: res.displayName ?? '',
      profilePhotoUrl: res.profilePhotoUrl ?? null,
      role: (res.role as User['role']) ?? 'USER',
      status: (res.status as User['status']) ?? 'ACTIVE',
      authProvider: (res.authProvider as User['authProvider']) ?? 'EMAIL',
      isEmailVerified: res.isEmailVerified ?? false,
    };
  }
}
