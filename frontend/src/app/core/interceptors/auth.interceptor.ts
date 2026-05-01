import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { switchMap, catchError, take } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SessionService } from '../services/session.service';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const isBookingsEndpoint = req.url.includes('/api/bookings');
  const isGuestEndpoint = req.url.includes('/api/bookings/guest');
  const isUserEndpoint = req.url.includes('/api/user');
  const isCarsEndpoint = req.url.includes('/api/cars');
  const isSettingsEndpoint = req.url.includes('/api/settings');
  const isDashboardEndpoint = req.url.includes('/api/dashboard');
  const isReportsEndpoint = req.url.includes('/api/reports');
  const isUploadEndpoint = req.url.includes('/api/upload');
  const isShiftsEndpoint = req.url.includes('/api/shifts');
  const isAuthPaymentEndpoint = req.url.includes('/api/payment/initiate-auth-pending') || req.url.includes('/api/payment/initiate-pending-update');
  const isPostRequest = req.method === 'POST';

  const shouldAttachToken = isUserEndpoint || isCarsEndpoint || isSettingsEndpoint || isDashboardEndpoint || isReportsEndpoint || isUploadEndpoint || isShiftsEndpoint || isAuthPaymentEndpoint || (isBookingsEndpoint && !(isGuestEndpoint && isPostRequest));
  
  if (!shouldAttachToken) {
    return next(req);
  }

  if (!environment.auth0.domain || !environment.auth0.clientId) {
    return next(req);
  }

  try {
    const authService = inject(AuthService);
    const sessionService = inject(SessionService);
    
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
        return next(authReq).pipe(
          catchError((error: HttpErrorResponse) => {
            if (error.status === 401) {
              sessionService.setSessionExpired();
            }
            return throwError(() => error);
          })
        );
      }),
      catchError((error) => {
        if (error?.error === 'login_required' || error?.error === 'consent_required' || error?.message?.includes('Login required')) {
          sessionService.setSessionExpired();
        }
        return throwError(() => error);
      })
    );
  } catch (error) {
    console.error('Auth interceptor error:', error);
    return next(req);
  }
};
