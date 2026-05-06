export interface CacheObject {
  endpoint: string;
  value: string;
  expires: number;
}

export interface CacheOptions {
  enabled?: boolean;
  minutesToExpire?: number;
}
