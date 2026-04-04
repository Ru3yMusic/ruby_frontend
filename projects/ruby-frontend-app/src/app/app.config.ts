import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { routes } from './app.routes';
import { API_GATEWAY_URL, AuthApiAdapter, AuthRepositoryPort } from 'lib-ruby-core';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptorsFromDi()),
    { provide: API_GATEWAY_URL, useValue: environment.apiGatewayUrl },
    // Hexagonal: bind port → adapter
    { provide: AuthRepositoryPort, useClass: AuthApiAdapter },
  ],
};
