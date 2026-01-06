import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { switchMap, catchError, take } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const isBookingsEndpoint = req.url.includes('/api/bookings');
  const isGuestEndpoint = req.url.includes('/api/bookings/guest');
  const isPostRequest = req.method === 'POST';
  
  const shouldAttachToken = isBookingsEndpoint && !(isGuestEndpoint && isPostRequest);
  
  if (!shouldAttachToken) {
    return next(req);
  }

  if (!environment.auth0.domain || !environment.auth0.clientId) {
    return next(req);
  }

  try {
    const authService = inject(AuthService);
    
    return authService.getAccessTokenSilently({
      authorizationParams: {
        audience: environment.auth0.audience
      }
    }).pipe(
      take(1),
      switchMap((token: string) => {
        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
        return next(authReq);
      }),
      catchError((error) => {
        console.error('Failed to get access token:', error);
        throw error;
      })
    );
  } catch (error) {
    console.error('Auth interceptor error:', error);
    return next(req);
  }
};
