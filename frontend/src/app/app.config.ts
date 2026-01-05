import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAuth0, authHttpInterceptorFn } from '@auth0/auth0-angular';

import { appRoutes } from './app-routing.module';
import { baseUrlInterceptor } from './core/interceptors/http.interceptor';
import { environment } from '../environments/environment';

const auth0Providers: Provider[] = environment.auth0.domain && environment.auth0.clientId
  ? [
      provideAuth0({
        domain: environment.auth0.domain,
        clientId: environment.auth0.clientId,
        authorizationParams: {
          redirect_uri: window.location.origin,
          audience: environment.auth0.audience
        },
        cacheLocation: 'localstorage',
        httpInterceptor: {
          allowedList: [
            {
              uri: `${window.location.origin}/api/bookings`,
              httpMethod: 'GET' as const,
              tokenOptions: {
                authorizationParams: {
                  audience: environment.auth0.audience
                }
              }
            },
            {
              uri: `${window.location.origin}/api/bookings/*`,
              httpMethod: 'GET' as const,
              tokenOptions: {
                authorizationParams: {
                  audience: environment.auth0.audience
                }
              }
            },
            {
              uri: `${window.location.origin}/api/bookings/*/delete`,
              httpMethod: 'PUT' as const,
              tokenOptions: {
                authorizationParams: {
                  audience: environment.auth0.audience
                }
              }
            }
          ]
        }
      })
    ]
  : [];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([baseUrlInterceptor, authHttpInterceptorFn])),
    ...auth0Providers
  ]
};
