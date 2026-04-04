import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing.page').then(m => m.LandingPage),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage),
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password-email/forgot-password-email.page').then(m => m.ForgotPasswordEmailPage),
  },
  {
    path: 'forgot-password/otp',
    loadComponent: () => import('./pages/forgot-password-otp/forgot-password-otp.page').then(m => m.ForgotPasswordOtpPage),
  },
  {
    path: 'register/email',
    loadComponent: () => import('./pages/register-email/register-email.page').then(m => m.RegisterEmailPage),
  },
  {
    path: 'register/password',
    loadComponent: () => import('./pages/register-password/register-password.page').then(m => m.RegisterPasswordPage),
  },
  {
    path: 'register/birthdate',
    loadComponent: () => import('./pages/register-birthdate/register-birthdate.page').then(m => m.RegisterBirthdatePage),
  },
  {
    path: 'register/gender',
    loadComponent: () => import('./pages/register-gender/register-gender.page').then(m => m.RegisterGenderPage),
  },
  {
    path: 'register/name',
    loadComponent: () => import('./pages/register-name/register-name.page').then(m => m.RegisterNamePage),
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./pages/verify-email/verify-email.page').then(m => m.VerifyEmailPage),
  },
];
