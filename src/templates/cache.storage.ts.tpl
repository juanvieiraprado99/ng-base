import { isPlatformBrowser } from "@angular/common";
import { inject, InjectionToken, PLATFORM_ID } from "@angular/core";

/** Minimal Web Storage contract used by CacheService. */
export type CacheStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;

/** Volatile Map-backed storage (lost on reload). */
export function memoryStorage(): CacheStorage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    key: (index) => [...store.keys()][index] ?? null,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

/**
 * localStorage / sessionStorage in the browser; `null` on the server (SSR), which
 * turns caching into a no-op there. Must run in an injection context.
 */
export function browserStorage(kind: "local" | "session"): CacheStorage | null {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return null;
  return kind === "local" ? localStorage : sessionStorage;
}

/**
 * Storage backing CacheService. Swap it in providers, e.g.
 * `{ provide: CACHE_STORAGE, useFactory: () => browserStorage("session") }`.
 * With SSR each server render gets its own root injector, so `memoryStorage()`
 * is not shared between requests (and browserStorage is a no-op there).
 */
export const CACHE_STORAGE = new InjectionToken<CacheStorage | null>(
  "CACHE_STORAGE",
  {
    providedIn: "root",
    factory: () => {{STORAGE_FACTORY}},
  },
);
