import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { Subject, catchError, throwError } from "rxjs";

/** Emits HTTP 5xx errors for global handling (toast, logging, etc.). */
export const globalServerError$ = new Subject<HttpErrorResponse>();

/**
 * Centralized handling: 401 → login, 403 → forbidden, 5xx → globalServerError$.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const status = error.status;
        if (status === 401) {
          void router.navigate(["/login"]);
        } else if (status === 403) {
          void router.navigate(["/forbidden"]);
        } else if (status >= 500 && status < 600) {
          globalServerError$.next(error);
        }
      }
      return throwError(() => error);
    })
  );
};
