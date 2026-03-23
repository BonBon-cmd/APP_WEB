import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './guards/auth.guards';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.page').then( m => m.LoginPage)
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register/register.page').then( m => m.RegisterPage)
  },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () => import('./tabs/tabs.page').then( m => m.TabsPage),
    children: [
      {
        path: 'home',
        loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'location',
        loadComponent: () => import('./pages/location/location.page').then( m => m.LocationPage)
      },
      {
        path: 'bookmark',
        canActivate: [roleGuard(['user'])],
        loadComponent: () => import('./pages/bookmark/bookmark.page').then( m => m.BookmarkPage)
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.page').then( m => m.ProfilePage)
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: 'place-detail',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/place-detail/place-detail.page').then( m => m.PlaceDetailPage)
  },
];
