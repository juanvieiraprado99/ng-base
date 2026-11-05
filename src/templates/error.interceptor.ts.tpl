import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { Subject, catchError, throwError } from "rxjs";
import { FORBIDDEN_ROUTE, LOGIN_ROUTE } from "{{IMPORT_ROUTES_TOKENS}}";
{{#if AUTH}}
import { AuthTokenStore } from "{{IMPORT_AUTH_STORE}}";
import { AUTH_ALLOWED_URLS, isAuthRequest } from "{{IMPORT_AUTH_TOKENS}}";
{{/if}}

/** Emits HTTP 5xx errors for global handling (toast, logging, etc.). */
@Injectable({ providedIn: "root" })
export class HttpErrorBus {
  private readonly serverErrors = new Subject<HttpErrorResponse>();
  readonly serverErrors$ = this.serverErrors.asObservable();

  emit(error: HttpErrorResponse): void {
    this.serverErrors.next(error);
  }
}

/**
 * 401 → LOGIN_ROUTE (with returnUrl), 403 → FORBIDDEN_ROUTE, 5xx → HttpErrorBus.
{{#if AUTH}}
 * A 401 only ends the session (token cleared + redirect) for requests the auth
 * interceptor authenticates — not third-party APIs, nor `skipAuth()` calls such
 * as a failed login.
{{/if}}
 * The error is always re-thrown so callers can still handle it.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const errorBus = inject(HttpErrorBus);
  const loginRoute = inject(LOGIN_ROUTE);
  const forbiddenRoute = inject(FORBIDDEN_ROUTE);
{{#if AUTH}}
  const tokenStore = inject(AuthTokenStore);
  const endsSession = isAuthRequest(req, inject(AUTH_ALLOWED_URLS));
{{/if}}
{{#if NO_AUTH}}
  const endsSession = true;
{{/if}}

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const currentUrl = router.url;
        if (error.status === 401) {
          if (endsSession) {
{{#if AUTH}}
            tokenStore.clear();
{{/if}}
            if (!currentUrl.startsWith(loginRoute)) {
              void router.navigate([loginRoute], {
                queryParams: { returnUrl: currentUrl },
              });
            }
          }
        } else if (error.status === 403) {
          void router.navigate([forbiddenRoute]);
        } else if (error.status >= 500 && error.status < 600) {
          errorBus.emit(error);
        }
      }
      return throwError(() => error);
    }),
  );
};
