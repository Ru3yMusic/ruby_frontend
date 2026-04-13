import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { TokenStorageService } from '../services/token-storage.service';

export const authGuard: CanActivateFn = () => {
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  const token = tokenStorage.getAccessToken();
  if (token && !tokenStorage.isTokenExpired(token)) {
    return true;
  }

  tokenStorage.clearTokens();
  return router.createUrlTree(['/auth/login']);
};
