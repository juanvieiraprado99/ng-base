import { computed, inject, Injectable, signal } from "@angular/core";
import { CacheService } from "{{IMPORT_CACHE_SERVICE}}";

/**
 * Holds the current access token as a signal. Call `set(token)` after login and
 * `clear()` on logout; the auth interceptor and auth guard read it reactively.
 *
 * Persistence is intentionally left out — add it here if you need the session to
 * survive a reload (prefer an HttpOnly cookie over Web Storage when you can).
 */
@Injectable({ providedIn: "root" })
export class AuthTokenStore {
  private readonly cache = inject(CacheService);
  private readonly _token = signal<string | null>(null);

  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => this._token() !== null);

  /**
   * Sets the token after login (or a refresh). A different token may mean a
   * different user, so cached responses are dropped — the cache can outlive the
   * in-memory token (e.g. localStorage after a reload).
   */
  set(token: string | null): void {
    if (token !== this._token()) this.cache.clear();
    this._token.set(token);
  }

  /** Logs out: drops the token and the response cache (it may hold user data). */
  clear(): void {
    this._token.set(null);
    this.cache.clear();
  }
}
