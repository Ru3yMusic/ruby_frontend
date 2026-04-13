import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { TokenStorageService } from '../services/token-storage.service';
import { AuthState } from '../../ruby-auth-ui/auth/state/auth.state';

export const adminGuard: CanActivateFn = () => {
  const tokenStorage = inject(TokenStorageService);
  const authState = inject(AuthState);
  const router = inject(Router);

  const token = tokenStorage.getAccessToken();
  if (!token || tokenStorage.isTokenExpired(token)) {
    tokenStorage.clearTokens();
    return router.createUrlTree(['/auth/login']);
  }

  const user = authState.currentUser();
  if (user?.role === 'ADMIN') {
    return true;
  }

  return router.createUrlTree(['/user/home']);
};
