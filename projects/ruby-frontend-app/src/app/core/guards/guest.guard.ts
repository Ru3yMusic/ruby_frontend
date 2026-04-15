import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { TokenStorageService } from '../services/token-storage.service';
import { AuthState } from '../../ruby-auth-ui/auth/state/auth.state';

/**
 * guestGuard — inverse of authGuard.
 *
 * Allows access to auth pages (login, register, onboarding) ONLY when the
 * user is NOT authenticated. If a valid token already exists, redirects the
 * user to their home dashboard so pressing the Back button from a protected
 * route never lands back on the login/register page.
 */
export const guestGuard: CanActivateFn = () => {
  const tokenStorage = inject(TokenStorageService);
  const authState = inject(AuthState);
  const router = inject(Router);

  const token = tokenStorage.getAccessToken();

  // No token or expired → user is a guest → allow access to auth pages
  if (!token || tokenStorage.isTokenExpired(token)) {
    return true;
  }

  // Valid token present → user is already authenticated
  // Redirect to the appropriate dashboard based on role
  const user = authState.currentUser();
  if (user?.role === 'ADMIN') {
    return router.createUrlTree(['/admin/dashboard']);
  }

  return router.createUrlTree(['/user/home']);
};
