import {
  HttpContext,
  HttpContextToken,
  HttpInterceptorFn,
  HttpResponse,
} from "@angular/common/http";
import { inject } from "@angular/core";
import { of, tap } from "rxjs";
import { CacheService } from "{{IMPORT_CACHE_SERVICE}}";

export interface CacheRequestOptions {
  /** Time to live in minutes (default 10). */
  ttlMinutes?: number;
}

/** Per-request cache opt-in; `null` means "do not cache". */
export const CACHE_REQUEST = new HttpContextToken<CacheRequestOptions | null>(
  () => null,
);

/**
 * Opt a GET into the response cache:
 * `http.get(url, { context: withCache({ ttlMinutes: 5 }) })`.
 */
export function withCache(
  options: CacheRequestOptions = {},
  context: HttpContext = new HttpContext(),
): HttpContext {
  return context.set(CACHE_REQUEST, options);
}

/**
 * Serves opted-in GET requests from CacheService and stores successful
 * responses. Keyed by `urlWithParams`, so different query strings are cached
 * separately. Works for HttpClient and httpResource alike. Only JSON responses
 * are cached (blob / text / arraybuffer bodies do not survive JSON storage).
 */
export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  const options = req.context.get(CACHE_REQUEST);
  if (!options || req.method !== "GET" || req.responseType !== "json") {
    return next(req);
  }

  const cache = inject(CacheService);
  const key = req.urlWithParams;
  const cached = cache.get(key);
  if (cached !== null) {
    return of(new HttpResponse({ body: cached, status: 200, url: req.url }));
  }

  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse && event.ok) {
        cache.set(key, event.body, options.ttlMinutes ?? 10);
      }
    }),
  );
};
