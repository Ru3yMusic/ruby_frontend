import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    loadChildren: () => import('./ruby-auth-ui/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  {
    path: 'onboarding',
    loadChildren: () => import('./ruby-auth-ui/onboarding/onboarding.routes').then(m => m.ONBOARDING_ROUTES),
  },
  {
    path: 'home',
    loadComponent: () => import('./user-ruby-music/pages/home/home.page').then(m => m.HomePage),
  },
  {
    path: 'station/:slug',
    loadComponent: () => import('./user-ruby-music/pages/station/station.page').then(m => m.StationPage),
  },
  {
    path: 'music',
    loadComponent: () => import('./user-ruby-music/pages/music-search/music-search.page').then(m => m.MusicSearchPage),
  },
  {
    path: 'music/player/:id',
    loadComponent: () => import('./user-ruby-music/pages/music-player/music-player.page').then(m => m.MusicPlayerPage),
  },
  {
    path: 'music/album/:slug',
    loadComponent: () => import('./user-ruby-music/pages/album/album.page').then(m => m.AlbumPage),
  },
  {
    path: 'music/artist/:slug',
    loadComponent: () => import('./user-ruby-music/pages/artist/artist.page').then(m => m.ArtistPage),
  },
  {
    path: 'library',
    loadComponent: () => import('./user-ruby-music/pages/library/library.page').then(m => m.LibraryPage),
  },
  {
    path: 'library/add-albums',
    loadComponent: () => import('./user-ruby-music/pages/album-explorer/album-explorer.page').then(m => m.AlbumExplorerPage),
  },
  {
    path: 'library/add-albums/success',
    loadComponent: () => import('./user-ruby-music/pages/add-albums-success/add-albums-success.page').then(m => m.AddAlbumsSuccessPage),
  },
  {
    path: 'library/add-artists',
    loadComponent: () => import('./user-ruby-music/pages/add-artists/add-artists.page').then(m => m.AddArtistsPage),
  },
  {
    path: 'library/add-artists/success',
    loadComponent: () => import('./user-ruby-music/pages/add-artists-success/add-artists-success.page').then(m => m.AddArtistsSuccessPage),
  },
  {
    path: 'library/playlist/new',
    loadComponent: () => import('./user-ruby-music/pages/playlist-create/playlist-create.page').then(m => m.PlaylistCreatePage),
  },
  {
    path: 'library/playlist/:id',
    loadComponent: () => import('./user-ruby-music/pages/playlist-detail/playlist-detail.page').then(m => m.PlaylistDetailPage),
  },
  {
    path: 'library/playlist/:id/add',
    loadComponent: () => import('./user-ruby-music/pages/playlist-add/playlist-add.page').then(m => m.PlaylistAddPage),
  },
  {
    path: 'library/playlist/:id/edit',
    loadComponent: () => import('./user-ruby-music/pages/playlist-edit/playlist-edit.page').then(m => m.PlaylistEditPage),
  },
  {
    path: 'amigos',
    loadComponent: () => import('./user-ruby-music/pages/amigos/amigos.page').then(m => m.AmigosPage),
  },
  {
    path: 'chat-estacion',
    loadComponent: () => import('./user-ruby-music/pages/chat-estacion/chat-estacion.page').then(m => m.ChatEstacionPage),
  },
  {
    path: 'notifications',
    loadComponent: () => import('./user-ruby-music/pages/notifications/notifications.page').then(m => m.NotificationsPage),
  },
  {
    path: 'profile/edit',
    loadComponent: () => import('./user-ruby-music/pages/editar-perfil/editar-perfil.page').then(m => m.EditarPerfilPage),
  },
  {
    path: 'admin',
    loadChildren: () =>
      import('./admin-ruby-music/admin.routes').then(m => m.ADMIN_ROUTES),
  },
  {
    path: '**',
    redirectTo: 'auth',
  },
];
