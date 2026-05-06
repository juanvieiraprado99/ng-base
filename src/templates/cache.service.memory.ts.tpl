import { inject, Injectable, InjectionToken } from "@angular/core";
import { CacheObject } from "{{IMPORT_CACHE_INTERFACE}}";

export const BASE_API_URL = new InjectionToken<string>("BASE_API_URL");

const PARSED_IDENTIFIER = "%OBJECT%";

/**
 * In-memory cache (Map). Volatile — useful in SSR/Node where Web Storage is unavailable.
 */
@Injectable({
  providedIn: "root",
})
export class CacheService {
  private readonly baseUrl = inject(BASE_API_URL, { optional: true }) ?? "";
  private readonly storagePrefix = "ngx-base-cli:";
  private readonly store = new Map<string, string>();

  set(endpoint: string, value: unknown, minutesToExpire: number = 10): void {
    endpoint = endpoint.replace(this.baseUrl, "");

    const key = this.storagePrefix + btoa(endpoint);
    const valueParsed =
      typeof value === "string"
        ? value
        : JSON.stringify(value) + PARSED_IDENTIFIER;

    const cacheObject: CacheObject = {
      endpoint,
      value: valueParsed,
      expires: this.getExpires(minutesToExpire),
    };

    try {
      const cacheObjectParsed = JSON.stringify(cacheObject);
      const cacheObjectB64 = btoa(cacheObjectParsed);
      this.store.set(key, cacheObjectB64);
    } catch {
      // encoding failure — silently ignored
    }
  }

  private getExpires(minutesToExpire: number): number {
    const now = new Date();
    const minutesInMs = 60_000 * minutesToExpire;
    return now.getTime() + minutesInMs;
  }

  get(endpoint: string): unknown | null {
    endpoint = endpoint.replace(this.baseUrl, "");
    const key = this.storagePrefix + btoa(endpoint);

    const cacheObjectB64: string | undefined = this.store.get(key);
    if (!cacheObjectB64) return null;

    try {
      const cacheObjectDecoded = atob(cacheObjectB64);
      const cacheObject = JSON.parse(cacheObjectDecoded) as CacheObject;

      const now = new Date();
      if (now.getTime() > cacheObject.expires) {
        this.store.delete(key);
        return null;
      }

      if (cacheObject.value.includes(PARSED_IDENTIFIER)) {
        const replaced = cacheObject.value.replace(PARSED_IDENTIFIER, "");
        return JSON.parse(replaced) as unknown;
      }

      return cacheObject.value;
    } catch {
      this.store.delete(key);
      return null;
    }
  }

  remove(endpoint: string): void {
    endpoint = endpoint.replace(this.baseUrl, "");
    const key = this.storagePrefix + btoa(endpoint);
    this.store.delete(key);
  }
}
