export interface CacheObject<T = unknown> {
  endpoint: string;
  value: T;
  /** Epoch milliseconds after which the entry is stale. */
  expires: number;
}

/**
 * Wrapper returned by `CacheService.get`. A hit is represented by the object
 * itself, so a cached falsy value (0, "", false, null) is not mistaken for a
 * cache miss.
 */
export interface CacheEntry<T = unknown> {
  value: T;
}

export interface CacheOptions {
  enabled?: boolean;
  minutesToExpire?: number;
}
