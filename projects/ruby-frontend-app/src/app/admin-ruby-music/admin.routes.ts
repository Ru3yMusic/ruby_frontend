import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },

 
  // DASHBOARD
 
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.page').then(m => m.DashboardPage),
  },

  // USUARIOS

  {
    path: 'usuarios',
    loadComponent: () =>
      import('./pages/gestion-usuarios/gestion-usuarios.page').then(m => m.GestionUsuariosPage),
  },

  
  // GÉNEROS

  {
    path: 'generos',
    loadComponent: () =>
      import('./pages/gestion-generos/gestion-generos.page').then(m => m.GestionGenerosPage),
  },

  
  // CANCIONES 
 
  {
    path: 'canciones',
    loadComponent: () =>
      import('./pages/gestion-canciones/gestion-canciones.page').then(m => m.GestionCancionesPage),
  },


  // ÁLBUMES
 
  {
    path: 'albumes',
    loadComponent: () =>
      import('./pages/gestion-albumes/gestion-albumes.page').then(m => m.GestionAlbumesPage),
  },

  
  // ARTISTAS

  {
    path: 'artistas',
    loadComponent: () =>
      import('./pages/gestion-artistas/gestion-artistas.page').then(m => m.GestionArtistasPage),
  },

 
  // ESTACIONES 
 
  {
    path: 'estaciones',
    loadComponent: () =>
      import('./pages/gestion-estaciones/gestion-estaciones.page').then(m => m.GestionEstacionesPage),
  },

 
  // REPORTES 
  
  {
    path: 'reportes',
    loadComponent: () =>
      import('./pages/gestion-reportes/gestion-reportes.page').then(m => m.GestionReportesPage),
  },


  // FALLBACK 

  {
    path: '**',
    redirectTo: 'dashboard',
  },
];