import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppUserRole } from '../models/user-profile.model';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.waitForInit();

  return authService.currentUser ? true : router.parseUrl('/login');
};

export const guestGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.waitForInit();

  return authService.currentUser ? router.parseUrl('/tabs/home') : true;
};

export const roleGuard = (roles: AppUserRole[]): CanActivateFn => {
  return async () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    await authService.waitForInit();

    if (!authService.currentUser) {
      return router.parseUrl('/login');
    }

    const currentRole = authService.currentRole;
    if (!currentRole || !roles.includes(currentRole)) {
      return router.parseUrl('/tabs/home');
    }

    return true;
  };
};
