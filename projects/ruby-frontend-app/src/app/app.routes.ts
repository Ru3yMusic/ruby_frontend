import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth',
    pathMatch: 'full',
  },

  {
    path: 'auth',
    loadChildren: () =>
      import('./ruby-auth-ui/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },

  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./ruby-auth-ui/onboarding/onboarding.routes').then(
        m => m.ONBOARDING_ROUTES
      ),
  },

  {
    path: 'admin',
    canActivate: [adminGuard],
    loadChildren: () =>
      import('./admin-ruby-music/admin.routes').then(m => m.ADMIN_ROUTES),
  },

  {
    path: 'user',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./user-ruby-music/user.routes').then(m => m.USER_ROUTES),
  },

  {
    path: '**',
    redirectTo: 'auth',
  },
];