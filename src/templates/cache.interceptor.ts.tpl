import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { of, tap } from 'rxjs';
import {
  CACHE_ENABLED,
  CACHE_MINUTES_TO_EXPIRE,
} from '{{BASE_SERVICE_IMPORT}}';
import { CacheService } from '{{CACHE_SERVICE_IMPORT}}';

/**
 * Serves and stores GET responses flagged with `CACHE_ENABLED` in the request
 * context. `BaseService.get` sets that flag; anything else passes straight
 * through.
 */
export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET' || !req.context.get(CACHE_ENABLED)) {
    return next(req);
  }

  const cacheService = inject(CacheService);
  const key = req.urlWithParams;

  const cached = cacheService.get<unknown>(key);
  if (cached) {
    return of(new HttpResponse({ body: cached.value, status: 200 }));
  }

  const minutesToExpire = req.context.get(CACHE_MINUTES_TO_EXPIRE);
  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        cacheService.set(key, event.body, minutesToExpire);
      }
    }),
  );
};
