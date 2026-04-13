import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { API_GATEWAY_URL, AuthApiAdapter, AuthRepositoryPort, RealtimeAdapter, RealtimePort } from 'lib-ruby-core';
import { environment } from '../environments/environment';
import { ApiModule as AuthSdkModule, Configuration as AuthSdkConfiguration } from 'lib-ruby-sdks/auth-service';
import { ApiModule as CatalogSdkModule, Configuration as CatalogSdkConfiguration } from 'lib-ruby-sdks/catalog-service';
import { ApiModule as PlaylistSdkModule, Configuration as PlaylistSdkConfiguration } from 'lib-ruby-sdks/playlist-service';
import { ApiModule as InteractionSdkModule, Configuration as InteractionSdkConfiguration } from 'lib-ruby-sdks/interaction-service';
import { ApiModule as SocialSdkModule, Configuration as SocialSdkConfiguration } from 'lib-ruby-sdks/social-service';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    { provide: API_GATEWAY_URL, useValue: environment.apiGatewayUrl },
    // Hexagonal: bind ports → adapters
    { provide: AuthRepositoryPort, useClass: AuthApiAdapter },
    { provide: RealtimePort, useClass: RealtimeAdapter },
    // SDK modules: configure each service with API gateway base path
    importProvidersFrom(
      AuthSdkModule.forRoot(() => new AuthSdkConfiguration({ basePath: environment.apiGatewayUrl })),
      CatalogSdkModule.forRoot(() => new CatalogSdkConfiguration({ basePath: environment.apiGatewayUrl })),
      PlaylistSdkModule.forRoot(() => new PlaylistSdkConfiguration({ basePath: environment.apiGatewayUrl })),
      InteractionSdkModule.forRoot(() => new InteractionSdkConfiguration({ basePath: environment.apiGatewayUrl })),
      SocialSdkModule.forRoot(() => new SocialSdkConfiguration({ basePath: environment.apiGatewayUrl })),
    ),
  ],
};
