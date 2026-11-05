import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { AuthTokenStore } from "{{IMPORT_AUTH_STORE}}";
import {
  AUTH_ALLOWED_URLS,
  isAllowedUrl,
  SKIP_AUTH,
} from "{{IMPORT_AUTH_TOKENS}}";

/**
 * Adds `Authorization: Bearer <token>` only to requests whose URL matches
 * AUTH_ALLOWED_URLS (default: BASE_API_URL). Opt out per request with
 * `{ context: skipAuth() }`.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthTokenStore).token();
  if (!token || req.context.get(SKIP_AUTH)) return next(req);

  const base = globalThis.location?.origin ?? "http://localhost";
  const allowed = inject(AUTH_ALLOWED_URLS).some((rule) =>
    isAllowedUrl(req.url, rule, base),
  );
  if (!allowed) return next(req);

  return next(
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
  );
};
