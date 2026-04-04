import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.page').then(m => m.DashboardPage),
  },
  {
    path: 'usuarios',
    loadComponent: () =>
      import('./pages/gestion-usuarios/gestion-usuarios.page').then(m => m.GestionUsuariosPage),
  },
  {
    path: 'generos',
    loadComponent: () =>
      import('./pages/gestion-generos/gestion-generos.page').then(m => m.GestionGenerosPage),
  },
  {
    path: 'artistas',
    loadComponent: () =>
      import('./pages/gestion-artistas/gestion-artistas.page').then(m => m.GestionArtistasPage),
  },
  {
    path: 'albumes',
    loadComponent: () =>
      import('./pages/gestion-albumes/gestion-albumes.page').then(m => m.GestionAlbumesPage),
  },
];
