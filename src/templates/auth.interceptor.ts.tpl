import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, throwError } from "rxjs";
import { AuthTokenStore } from "{{IMPORT_AUTH_STORE}}";
import {
  AUTH_ALLOWED_URLS,
  isAuthRequest,
  LOGIN_ROUTE,
} from "{{IMPORT_AUTH_TOKENS}}";

/**
 * Adds `Authorization: Bearer <token>` only to requests whose URL matches
 * AUTH_ALLOWED_URLS (default: BASE_API_URL). Opt out per request with
 * `{ context: skipAuth() }`.
 *
 * A 401 on a request it authenticated ends the session: the token is cleared
 * and the user is sent to LOGIN_ROUTE (with `returnUrl`). 401s from other APIs
 * or `skipAuth()` calls (e.g. a failed login) are just re-thrown.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenStore = inject(AuthTokenStore);
  const token = tokenStore.token();
  if (!token || !isAuthRequest(req, inject(AUTH_ALLOWED_URLS))) {
    return next(req);
  }

  const router = inject(Router);
  const loginRoute = inject(LOGIN_ROUTE);
  return next(
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
  ).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        tokenStore.clear();
        const currentUrl = router.url;
        if (!currentUrl.startsWith(loginRoute)) {
          void router.navigate([loginRoute], {
            queryParams: { returnUrl: currentUrl },
          });
        }
      }
      return throwError(() => error);
    }),
  );
};
