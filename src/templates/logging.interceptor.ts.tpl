import { HttpInterceptorFn } from "@angular/common/http";
import { isDevMode } from "@angular/core";
import { tap } from "rxjs";

export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isDevMode()) return next(req);

  const start = performance.now();
  return next(req).pipe(
    tap({
      next: () => {
        const elapsed = (performance.now() - start).toFixed(0);
        console.log(`[HTTP] ${req.method} ${req.url} — ${elapsed}ms`);
      },
      error: (err) => {
        const elapsed = (performance.now() - start).toFixed(0);
        console.error(
          `[HTTP] ${req.method} ${req.url} — ${elapsed}ms — ERROR`,
          err
        );
      },
    })
  );
};
