import { InjectionToken } from "@angular/core";

/** Where unauthenticated users are sent (guard + 401 handling). Override in providers. */
export const LOGIN_ROUTE = new InjectionToken<string>("LOGIN_ROUTE", {
  providedIn: "root",
  factory: () => "/login",
});

/** Where users without permission are sent (403 handling). Override in providers. */
export const FORBIDDEN_ROUTE = new InjectionToken<string>("FORBIDDEN_ROUTE", {
  providedIn: "root",
  factory: () => "/forbidden",
});
