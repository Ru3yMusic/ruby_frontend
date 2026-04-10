import { Routes } from '@angular/router';
import { UserLayoutComponent } from './layout/user-layout/user-layout.component';
import { HomeComponent } from './pages/home/home.component';
import { NotificationsComponent } from './pages/notifications/notifications.component';
import { ChatStationComponent } from './pages/chat-station/chat-station.component';
import { FriendsComponent } from './pages/friends/friends.component';
import { LibraryComponent } from './pages/library/library.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { PlaylistDetailComponent } from './pages/playlist-detail/playlist-detail.component';
import { AlbumDetailComponent } from './pages/album-detail/album-detail.component';
import { ArtistDetailComponent } from './pages/artist-detail/artist-detail.component';
import { MusicComponent } from './pages/music/music.component';
import { StationComponent } from './pages/station/station.component';
import { StationDetailComponent } from './pages/station-detail/station-detail.component';

export const USER_ROUTES: Routes = [
  {
    path: '',
    component: UserLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
      {
        path: 'home',
        component: HomeComponent,
      },
      {
        path: 'notifications',
        component: NotificationsComponent,
      },
      {
        path: 'chat-station',
        component: ChatStationComponent,
      },
      {
        path: 'friends',
        component: FriendsComponent,
      },
      {
        path: 'library',
        component: LibraryComponent,
      },
      {
        path: 'profile',
        component: ProfileComponent,
      },
      {
        path: 'playlist/:id',
        component: PlaylistDetailComponent,
      },
      {
        path: 'album/:id',
        component: AlbumDetailComponent,
      },
      {
        path: 'artist/:id',
        component: ArtistDetailComponent,
      },
      {
        path: 'music',
        component: MusicComponent,
      },
      {
        path: 'station',
        component: StationComponent,
      },
      {
        path: 'station/:id',
        component: StationDetailComponent,
      },

    ],
  },
];