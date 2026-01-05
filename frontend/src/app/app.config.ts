import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAuth0 } from '@auth0/auth0-angular';

import { appRoutes } from './app-routing.module';
import { baseUrlInterceptor } from './core/interceptors/http.interceptor';
import { environment } from '../environments/environment';

const auth0Providers: Provider[] = environment.auth0.domain && environment.auth0.clientId
  ? [
      provideAuth0({
        domain: environment.auth0.domain,
        clientId: environment.auth0.clientId,
        authorizationParams: {
          redirect_uri: window.location.origin
        },
        cacheLocation: 'localstorage'
      })
    ]
  : [];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([baseUrlInterceptor])),
    ...auth0Providers
  ]
};
