import {
  HttpClient,
  HttpContext,
  HttpContextToken,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { inject, {{SERVICE_DECORATOR_IMPORT}} } from '@angular/core';
import { CacheOptions } from '{{IMPORT_CACHE_INTERFACE}}';
import { Observable, of, retry, take, tap } from 'rxjs';
import { BASE_API_URL, CacheService } from './cache.service';

/**
 * Request-scoped cache hints. `BaseService.get` sets them, and the optional
 * generated `cache.interceptor.ts` reads them; they are also a stable extension
 * point for your own interceptors.
 */
export const CACHE_ENABLED = new HttpContextToken(() => false);
export const CACHE_MINUTES_TO_EXPIRE = new HttpContextToken(() => 10);

{{SERVICE_DECORATOR}}
export class BaseService {
  private readonly httpClient = inject(HttpClient);
  private readonly cacheService = inject(CacheService);
  private readonly baseApiUrl = inject(BASE_API_URL, { optional: true });

  protected buildUrl(endpoint: string): string {
    return this.baseApiUrl ? `${this.baseApiUrl}${endpoint}` : endpoint;
  }

  /**
   * Cache key for a request. Query parameters are part of it: without them,
   * `?page=1` and `?page=2` would share a single entry.
   */
  protected cacheKey(url: string, params?: HttpParams): string {
    const query = params?.toString();
    return query ? `${url}?${query}` : url;
  }

  get<T>(
    endpoint: string,
    cacheOptions: CacheOptions = {},
    retryNumber = 0,
    params?: HttpParams,
  ): Observable<T> {
    const url = this.buildUrl(endpoint);
    const key = this.cacheKey(url, params);
    const minutesToExpire = cacheOptions.minutesToExpire ?? 10;

    if (cacheOptions.enabled) {
      const cached = this.cacheService.get<T>(key);
      if (cached) {
        return of(cached.value).pipe(take(1));
      }
    }

    const request$ = this.httpClient.get<T>(url, {
      params,
      context: new HttpContext()
        .set(CACHE_ENABLED, cacheOptions.enabled ?? false)
        .set(CACHE_MINUTES_TO_EXPIRE, minutesToExpire),
    });

    const retried$ =
      retryNumber > 0 ? request$.pipe(retry(retryNumber)) : request$;

    return retried$.pipe(
      tap((data) => {
        if (cacheOptions.enabled) {
          this.cacheService.set(key, data, minutesToExpire);
        }
      }),
      take(1),
    );
  }

  patch<T>(
    endpoint: string,
    payload: unknown,
    headers?: HttpHeaders | { [header: string]: string | string[] },
  ): Observable<T> {
    return this.httpClient
      .patch<T>(this.buildUrl(endpoint), payload, { headers })
      .pipe(take(1));
  }

  post<T>(
    endpoint: string,
    payload: unknown,
    retryNumber = 0,
    headers?: HttpHeaders | { [header: string]: string | string[] },
  ): Observable<T> {
    const request$ = this.httpClient.post<T>(this.buildUrl(endpoint), payload, {
      headers,
    });
    const retried$ =
      retryNumber > 0 ? request$.pipe(retry(retryNumber)) : request$;
    return retried$.pipe(take(1));
  }

  put<T>(endpoint: string, payload: unknown): Observable<T> {
    return this.httpClient
      .put<T>(this.buildUrl(endpoint), payload)
      .pipe(take(1));
  }

  delete<T>(endpoint: string, body?: unknown): Observable<T> {
    return this.httpClient
      .delete<T>(this.buildUrl(endpoint), body ? { body } : {})
      .pipe(take(1));
  }

  /** Drop the cached entry for an endpoint (pass the same params used on `get`). */
  invalidateCache(endpoint: string, params?: HttpParams): void {
    this.cacheService.remove(this.cacheKey(this.buildUrl(endpoint), params));
  }
}
