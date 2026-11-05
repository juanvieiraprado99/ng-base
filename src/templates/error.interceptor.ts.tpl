import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject, Injectable, InjectionToken } from "@angular/core";
import { Router } from "@angular/router";
import { Subject, catchError, throwError } from "rxjs";

/** Where users without permission are sent on a 403. Override in providers. */
export const FORBIDDEN_ROUTE = new InjectionToken<string>("FORBIDDEN_ROUTE", {
  providedIn: "root",
  factory: () => "/forbidden",
});

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
 * 403 → FORBIDDEN_ROUTE, 5xx → HttpErrorBus. The error is always re-thrown so
 * callers can still handle it. (401s are the auth module's job.)
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const errorBus = inject(HttpErrorBus);
  const forbiddenRoute = inject(FORBIDDEN_ROUTE);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 403) {
          void router.navigate([forbiddenRoute]);
        } else if (error.status >= 500 && error.status < 600) {
          errorBus.emit(error);
        }
      }
      return throwError(() => error);
    }),
  );
};
