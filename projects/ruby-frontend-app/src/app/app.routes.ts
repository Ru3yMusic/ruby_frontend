import { Routes } from '@angular/router';

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
    loadChildren: () =>
      import('./ruby-auth-ui/onboarding/onboarding.routes').then(
        m => m.ONBOARDING_ROUTES
      ),
  },

  {
    path: 'admin',
    loadChildren: () =>
      import('./admin-ruby-music/admin.routes').then(m => m.ADMIN_ROUTES),
  },

  {
    path: 'user',
    loadChildren: () =>
      import('./user-ruby-music/user.routes').then(m => m.USER_ROUTES),
  },

  {
    path: '**',
    redirectTo: 'auth',
  },
];