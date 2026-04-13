import { Routes } from '@angular/router';

export const USER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/user-layout/user-layout.component').then(
        m => m.UserLayoutComponent
      ),
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
      {
        path: 'home',
        loadComponent: () =>
          import('./pages/home/home.component').then(m => m.HomeComponent),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./pages/notifications/notifications.component').then(
            m => m.NotificationsComponent
          ),
      },
      {
        path: 'chat-station',
        loadComponent: () =>
          import('./pages/chat-station/chat-station.component').then(
            m => m.ChatStationComponent
          ),
      },
      {
        path: 'friends',
        loadComponent: () =>
          import('./pages/friends/friends.component').then(
            m => m.FriendsComponent
          ),
      },
      {
        path: 'library',
        loadComponent: () =>
          import('./pages/library/library.component').then(
            m => m.LibraryComponent
          ),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.component').then(
            m => m.ProfileComponent
          ),
      },
      {
        path: 'playlist/:id',
        loadComponent: () =>
          import('./pages/playlist-detail/playlist-detail.component').then(
            m => m.PlaylistDetailComponent
          ),
      },
      {
        path: 'album/:id',
        loadComponent: () =>
          import('./pages/album-detail/album-detail.component').then(
            m => m.AlbumDetailComponent
          ),
      },
      {
        path: 'artist/:id',
        loadComponent: () =>
          import('./pages/artist-detail/artist-detail.component').then(
            m => m.ArtistDetailComponent
          ),
      },
      {
        path: 'music',
        loadComponent: () =>
          import('./pages/music/music.component').then(m => m.MusicComponent),
      },
      {
        path: 'station',
        loadComponent: () =>
          import('./pages/station/station.component').then(
            m => m.StationComponent
          ),
      },
      {
        path: 'station/:id',
        loadComponent: () =>
          import('./pages/station-detail/station-detail.component').then(
            m => m.StationDetailComponent
          ),
      },
      {
        path: 'song/:id',
        loadComponent: () =>
          import('./pages/song-detail/song-detail.component').then(
            m => m.SongDetailComponent
          ),
      },
    ],
  },
];
