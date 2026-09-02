import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BASE_API_URL } from '{{BASE_API_URL_IMPORT}}';
import { {{AUTH_TOKEN_NAME}} } from '{{AUTH_TOKEN_IMPORT}}';

/**
 * Adds `Authorization: Bearer <token>` to requests aimed at your own API.
 *
 * `{{AUTH_TOKEN_NAME}}` must be an `InjectionToken<() => string | null>` exported
 * from `{{AUTH_TOKEN_IMPORT}}` and registered in `providers`. A getter (rather
 * than a plain string) is what lets the interceptor pick up a refreshed token.
 *
 * Requests to other origins are left untouched — attaching the token to a
 * third-party URL would leak the user's credentials.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const baseApiUrl = inject(BASE_API_URL, { optional: true });
  const getToken = inject({{AUTH_TOKEN_NAME}}, { optional: true });

  if (!getToken || !isOwnApi(req.url, baseApiUrl)) {
    return next(req);
  }

  const token = getToken();
  if (!token) {
    return next(req);
  }

  return next(
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
  );
};

/** Relative URLs are same-origin; absolute ones must match BASE_API_URL. */
function isOwnApi(url: string, baseApiUrl: string | null): boolean {
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return true;
  return baseApiUrl ? url.startsWith(baseApiUrl) : false;
}
