import { HttpContext, HttpContextToken } from "@angular/common/http";
import { inject, InjectionToken } from "@angular/core";
import { BASE_API_URL } from "{{IMPORT_API_TOKENS}}";

/**
 * URLs allowed to receive the Bearer token, matched by origin + path prefix.
 * Defaults to BASE_API_URL only. Add more APIs in providers:
 * `{ provide: AUTH_ALLOWED_URLS, useValue: [environment.baseApiUrl, "https://files.example.com/api"] }`.
 */
export const AUTH_ALLOWED_URLS = new InjectionToken<readonly string[]>(
  "AUTH_ALLOWED_URLS",
  {
    providedIn: "root",
    factory: () => {
      const base = inject(BASE_API_URL, { optional: true });
      return base ? [base] : [];
    },
  },
);

/** Per-request opt-out (login, refresh, public endpoints). */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

/** `http.post(url, body, { context: skipAuth() })` — send without the token. */
export function skipAuth(context: HttpContext = new HttpContext()): HttpContext {
  return context.set(SKIP_AUTH, true);
}

/**
 * True when `url` has the same origin as `allowed` and its path starts with
 * `allowed`'s path on a segment boundary. Relative URLs resolve against `base`.
 * Uses URL parsing, so `https://api.example.com.evil.io` never matches
 * `https://api.example.com`.
 */
export function isAllowedUrl(url: string, allowed: string, base: string): boolean {
  try {
    const target = new URL(url, base);
    const rule = new URL(allowed, base);
    if (target.origin !== rule.origin) return false;
    const prefix = rule.pathname.replace(/\/+$/, "");
    return (
      prefix === "" ||
      target.pathname === prefix ||
      target.pathname.startsWith(`${prefix}/`)
    );
  } catch {
    return false;
  }
}
