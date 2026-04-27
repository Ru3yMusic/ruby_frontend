import { Routes } from '@angular/router';

export const ONBOARDING_ROUTES: Routes = [
  {
    path: 'artists',
    loadComponent: () => import('./pages/station-picker/station-picker.page').then(m => m.StationPickerPage),
  },
  {
    path: 'stations',
    redirectTo: 'artists',
    pathMatch: 'full',
  },
  {
    path: 'complete',
    loadComponent: () => import('./pages/onboarding-complete/onboarding-complete.page').then(m => m.OnboardingCompletePage),
  },
];
