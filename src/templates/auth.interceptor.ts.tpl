import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { {{AUTH_TOKEN_NAME}} } from "{{AUTH_TOKEN_IMPORT}}";

/**
 * Injects `Authorization: Bearer <token>` when the token is available.
 * Export `{{AUTH_TOKEN_NAME}}` from the module at `AUTH_TOKEN_IMPORT` and register it in `providers`.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject({{AUTH_TOKEN_NAME}}, { optional: true });
  if (!token) {
    return next(req);
  }
  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
  return next(authReq);
};
