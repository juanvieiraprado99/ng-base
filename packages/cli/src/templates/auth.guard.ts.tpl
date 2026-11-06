import { inject } from "@angular/core";
import { CanMatchFn, Router } from "@angular/router";
import { AuthTokenStore } from "{{IMPORT_AUTH_STORE}}";
import { LOGIN_ROUTE } from "{{IMPORT_AUTH_TOKENS}}";

/** Lets the route match only when a token is present; otherwise redirects to LOGIN_ROUTE. */
export const authGuard: CanMatchFn = (_route, segments) => {
  if (inject(AuthTokenStore).isAuthenticated()) {
    return true;
  }
  const returnUrl = `/${segments.map((s) => s.path).join("/")}`;
  return inject(Router).createUrlTree([inject(LOGIN_ROUTE)], {
    queryParams: { returnUrl },
  });
};
