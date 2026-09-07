import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { map, filter, switchMap, catchError, take } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SettingsService } from '../services/settings.service';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  if (!environment.auth0.domain || !environment.auth0.clientId) {
    router.navigate(['/']);
    return false;
  }

  try {
    const authService = inject(AuthService);

    return authService.isLoading$.pipe(
      filter(loading => !loading),
      take(1),
      switchMap(() => authService.isAuthenticated$.pipe(take(1))),
      map(isAuthenticated => {
        if (isAuthenticated) {
          return true;
        }
        router.navigate(['/']);
        return false;
      }),
      catchError(() => {
        router.navigate(['/']);
        return of(false);
      })
    );
  } catch {
    router.navigate(['/']);
    return false;
  }
};

/**
 * Blocks direct/manual navigation to the guest booking form when the admin has
 * disabled it (configurationSetting_showGuestForm). Uses the unauthenticated
 * public settings endpoint since guests aren't logged in at this point.
 * Fails open on error so a transient API issue doesn't lock guests out.
 */
export const guestFormGuard: CanActivateFn = () => {
  const router = inject(Router);
  const settingsService = inject(SettingsService);

  return settingsService.getPublicSettings().pipe(
    take(1),
    map(settings => {
      if (settings.showGuestForm) {
        return true;
      }
      router.navigate(['/']);
      return false;
    }),
    catchError(() => of(true))
  );
};
