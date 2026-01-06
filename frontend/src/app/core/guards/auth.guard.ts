import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { map, filter, switchMap, catchError, take } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';

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
