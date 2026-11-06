import { inject, Injectable } from "@angular/core";
import { CacheObject } from "@core/interfaces/cache.model";
import { BASE_API_URL } from "@core/tokens/api-tokens";
import { CACHE_STORAGE } from "./cache-storage";

/** Expiring key/value response cache on top of CACHE_STORAGE. */
@Injectable({
  providedIn: "root",
})
export class CacheService {
  private readonly baseUrl = inject(BASE_API_URL, { optional: true }) ?? "";
  private readonly storage = inject(CACHE_STORAGE);
  private readonly storagePrefix = "ngx-base-cli:";

  set(key: string, value: unknown, minutesToExpire: number = 10): void {
    if (!this.storage) return;
    const cacheObject: CacheObject = {
      endpoint: this.stripBase(key),
      value,
      expires: Date.now() + 60_000 * minutesToExpire,
    };
    try {
      this.storage.setItem(this.keyFor(key), JSON.stringify(cacheObject));
    } catch {
      // QuotaExceededError or non-serializable value — skip caching
    }
  }

  /** Returns the cached value, or `null` when absent or expired. */
  get<T = unknown>(key: string): T | null {
    if (!this.storage) return null;
    const storageKey = this.keyFor(key);
    const raw = this.storage.getItem(storageKey);
    if (raw === null) return null;

    try {
      const cacheObject = JSON.parse(raw) as CacheObject;
      if (Date.now() > cacheObject.expires) {
        this.storage.removeItem(storageKey);
        return null;
      }
      return cacheObject.value as T;
    } catch {
      this.storage.removeItem(storageKey);
      return null;
    }
  }

  remove(key: string): void {
    this.storage?.removeItem(this.keyFor(key));
  }

  /** Drops every entry written by this service (e.g. on logout). */
  clear(): void {
    const storage = this.storage;
    if (!storage) return;
    const owned: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(this.storagePrefix)) owned.push(key);
    }
    for (const key of owned) storage.removeItem(key);
  }

  private stripBase(key: string): string {
    return this.baseUrl && key.startsWith(this.baseUrl)
      ? key.slice(this.baseUrl.length)
      : key;
  }

  private keyFor(key: string): string {
    return this.storagePrefix + this.stripBase(key);
  }
}
