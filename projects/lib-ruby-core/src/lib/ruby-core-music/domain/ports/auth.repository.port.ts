import { Observable } from 'rxjs';
import { AuthToken } from '../models/auth-token.model';
import { RegisterPayload, User } from '../models/user.model';

export abstract class AuthRepositoryPort {
  abstract login(email: string, password: string): Observable<AuthToken>;
  abstract loginWithGoogle(googleIdToken: string): Observable<AuthToken>;
  abstract register(payload: RegisterPayload): Observable<User>;
  abstract verifyEmailOtp(email: string, code: string, type: 'REGISTER' | 'PASSWORD_RESET'): Observable<void>;
  abstract resendOtp(email: string, type: 'REGISTER' | 'PASSWORD_RESET'): Observable<void>;
  abstract requestPasswordReset(email: string): Observable<void>;
  abstract resetPassword(email: string, code: string, newPassword: string): Observable<void>;
  abstract logout(refreshToken: string): Observable<void>;
  abstract refreshToken(refreshToken: string): Observable<AuthToken>;
}
