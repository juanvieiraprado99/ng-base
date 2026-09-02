import { inject, InjectionToken, {{SERVICE_DECORATOR_IMPORT}} } from '@angular/core';
import { CacheEntry, CacheObject } from '{{IMPORT_CACHE_INTERFACE}}';

export const BASE_API_URL = new InjectionToken<string>('BASE_API_URL');

/**
 * In-memory cache (Map). Volatile — the right choice under SSR/Node, where Web
 * Storage does not exist and per-request isolation matters.
 */
{{SERVICE_DECORATOR}}
export class CacheService {
  private readonly baseUrl = inject(BASE_API_URL, { optional: true }) ?? '';
  private readonly store = new Map<string, CacheObject>();

  private key(endpoint: string): string {
    return this.baseUrl && endpoint.startsWith(this.baseUrl)
      ? endpoint.slice(this.baseUrl.length)
      : endpoint;
  }

  set(endpoint: string, value: unknown, minutesToExpire = 10): void {
    this.store.set(this.key(endpoint), {
      endpoint,
      value,
      expires: Date.now() + 60_000 * minutesToExpire,
    });
  }

  /** `null` means "no usable entry"; a hit is wrapped so falsy values survive. */
  get<T>(endpoint: string): CacheEntry<T> | null {
    const cacheObject = this.store.get(this.key(endpoint));
    if (!cacheObject) return null;

    if (Date.now() > cacheObject.expires) {
      this.store.delete(this.key(endpoint));
      return null;
    }

    return { value: cacheObject.value as T };
  }

  remove(endpoint: string): void {
    this.store.delete(this.key(endpoint));
  }

  /** Drop every entry — useful between SSR requests. */
  clear(): void {
    this.store.clear();
  }
}
