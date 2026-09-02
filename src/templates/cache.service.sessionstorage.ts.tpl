import { inject, InjectionToken, {{SERVICE_DECORATOR_IMPORT}} } from '@angular/core';
import { CacheEntry, CacheObject } from '{{IMPORT_CACHE_INTERFACE}}';

export const BASE_API_URL = new InjectionToken<string>('BASE_API_URL');

/** Cache backed by `sessionStorage` — scoped to a single browser tab. */
{{SERVICE_DECORATOR}}
export class CacheService {
  private readonly baseUrl = inject(BASE_API_URL, { optional: true }) ?? '';
  private readonly storagePrefix = 'ngx-base-cli:';

  private key(endpoint: string): string {
    const relative =
      this.baseUrl && endpoint.startsWith(this.baseUrl)
        ? endpoint.slice(this.baseUrl.length)
        : endpoint;
    return this.storagePrefix + relative;
  }

  set(endpoint: string, value: unknown, minutesToExpire = 10): void {
    const cacheObject: CacheObject = {
      endpoint,
      value,
      expires: Date.now() + 60_000 * minutesToExpire,
    };
    try {
      sessionStorage.setItem(this.key(endpoint), JSON.stringify(cacheObject));
    } catch {
      // QuotaExceededError, blocked storage, or a non-serializable payload.
      // Caching is best-effort, so a failed write is not an error.
    }
  }

  /** `null` means "no usable entry"; a hit is wrapped so falsy values survive. */
  get<T>(endpoint: string): CacheEntry<T> | null {
    let raw: string | null;
    try {
      raw = sessionStorage.getItem(this.key(endpoint));
    } catch {
      return null;
    }
    if (raw === null) return null;

    try {
      const cacheObject = JSON.parse(raw) as CacheObject<T>;
      if (Date.now() > cacheObject.expires) {
        this.remove(endpoint);
        return null;
      }
      return { value: cacheObject.value };
    } catch {
      this.remove(endpoint);
      return null;
    }
  }

  remove(endpoint: string): void {
    try {
      sessionStorage.removeItem(this.key(endpoint));
    } catch {
      // Storage unavailable — nothing to clean up.
    }
  }
}
