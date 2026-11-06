export interface CacheObject {
  endpoint: string;
  value: unknown;
  expires: number;
}

/**
 * @deprecated Kept so a legacy `base.service.ts` still compiles. Use
 * `ApiClient.get(url, { cache: { ttlMinutes } })` or `withCache()` instead.
 */
export interface CacheOptions {
  enabled?: boolean;
  minutesToExpire?: number;
}
