import { InjectionToken } from "@angular/core";

/**
 * Base URL prepended to every endpoint by BaseService / CacheService.
 * Provided in app.config.ts: `{ provide: BASE_API_URL, useValue: environment.baseApiUrl }`.
 */
export const BASE_API_URL = new InjectionToken<string>("BASE_API_URL");
