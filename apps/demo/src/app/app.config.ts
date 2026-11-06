import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { environment } from '../environments/environment';
import { cacheInterceptor } from './core/interceptors/cache-interceptor';
import { errorInterceptor } from './core/interceptors/error-interceptor';
import { BASE_API_URL } from './core/tokens/api-tokens';
import { routes } from './app.routes';
import { provideZard } from '@/shared/core/provider/providezard';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      }),
    ),
    provideClientHydration(),
    provideHttpClient(withInterceptors([errorInterceptor, cacheInterceptor])),
    { provide: BASE_API_URL, useValue: environment.baseApiUrl },
    provideZard(),
  ],
};
