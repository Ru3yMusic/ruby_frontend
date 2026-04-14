import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { AuthRepositoryPort } from 'lib-ruby-core';
import { TokenStorageService } from '../services/token-storage.service';

const AUTH_PASSTHROUGH_PATTERNS = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/resend-otp',
  '/api/v1/auth/verify-email',
  '/api/v1/auth/password/',
];

// Module-level state shared across all interceptor invocations
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

function isAuthEndpoint(url: string): boolean {
  return AUTH_PASSTHROUGH_PATTERNS.some(pattern => url.includes(pattern));
}

function addAuthHeader(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function handle401(
  req: HttpRequest<unknown>,
  next: Parameters<HttpInterceptorFn>[1],
  tokenStorage: TokenStorageService,
  authRepo: AuthRepositoryPort,
  router: Router,
): Observable<unknown> {
  // Another request already kicked off a refresh — queue behind it
  if (isRefreshing) {
    return refreshTokenSubject.pipe(
      filter((token): token is string => token !== null),
      take(1),
      switchMap(newToken => next(addAuthHeader(req, newToken))),
    );
  }

  isRefreshing = true;
  refreshTokenSubject.next(null);

  const storedRefreshToken = tokenStorage.getRefreshToken();

  if (!storedRefreshToken) {
    isRefreshing = false;
    tokenStorage.clearTokens();
    router.navigate(['/auth/login']);
    return throwError(() => new Error('No refresh token available'));
  }

  return authRepo.refreshToken(storedRefreshToken).pipe(
    switchMap(authToken => {
      isRefreshing = false;
      tokenStorage.setTokens(authToken.accessToken, authToken.refreshToken);
      refreshTokenSubject.next(authToken.accessToken);
      return next(addAuthHeader(req, authToken.accessToken));
    }),
    catchError(refreshError => {
      isRefreshing = false;
      tokenStorage.clearTokens();
      router.navigate(['/auth/login']);
      return throwError(() => refreshError);
    }),
  );
}

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenStorage = inject(TokenStorageService);
  const authRepo = inject(AuthRepositoryPort);
  const router = inject(Router);

  const skipAuth = isAuthEndpoint(req.url);
  const token = tokenStorage.getAccessToken();

  const authReq = !skipAuth && token ? addAuthHeader(req, token) : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || skipAuth) {
        return throwError(() => error);
      }

      return handle401(req, next, tokenStorage, authRepo, router) as Observable<HttpEvent<unknown>>;
    }),
  );
};
