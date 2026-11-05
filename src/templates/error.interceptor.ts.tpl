import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { Subject, catchError, throwError } from "rxjs";
import { FORBIDDEN_ROUTE, LOGIN_ROUTE } from "{{IMPORT_ROUTES_TOKENS}}";

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
 * The error is always re-thrown so callers can still handle it.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const errorBus = inject(HttpErrorBus);
  const loginRoute = inject(LOGIN_ROUTE);
  const forbiddenRoute = inject(FORBIDDEN_ROUTE);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const currentUrl = router.url;
        if (error.status === 401 && !currentUrl.startsWith(loginRoute)) {
          void router.navigate([loginRoute], {
            queryParams: { returnUrl: currentUrl },
          });
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
