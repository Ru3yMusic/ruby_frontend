import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'welcome',
    pathMatch: 'full',
  },
  {
    path: 'welcome',
    loadComponent: () =>
      import('./pages/welcome/welcome.page').then(m => m.WelcomePage),
  },

  // dejamos estos porque sí son flujos aparte
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./pages/forgot-password-email/forgot-password-email.page')
        .then(m => m.ForgotPasswordEmailPage),
  },
  {
    path: 'forgot-password/otp',
    loadComponent: () =>
      import('./pages/forgot-password-otp/forgot-password-otp.page')
        .then(m => m.ForgotPasswordOtpPage),
  },

  {
    path: 'verify-email',
    loadComponent: () =>
      import('./pages/verify-email/verify-email.page')
        .then(m => m.VerifyEmailPage),
  },
];