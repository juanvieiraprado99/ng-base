import {
  HttpClient,
  HttpContext,
  HttpContextToken,
  HttpHeaders,
  HttpParams,
} from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { CacheOptions } from "{{IMPORT_CACHE_INTERFACE}}";
import { Observable, of, retry, take, tap } from "rxjs";
import { BASE_API_URL, CacheService } from "./cache.service";

export const CACHE_ENABLED = new HttpContextToken(() => false);
export const CACHE_MINUTES_TO_EXPIRE = new HttpContextToken(() => 10);

@Injectable({
  providedIn: "root",
})
export class BaseService {
  private readonly httpClient = inject(HttpClient);
  private readonly cacheService = inject(CacheService);
  private readonly baseApiUrl = inject(BASE_API_URL, { optional: true });

  private buildUrl(endpoint: string): string {
    return this.baseApiUrl ? `${this.baseApiUrl}${endpoint}` : endpoint;
  }

  get<T>(
    endpoint: string,
    cacheOptions: CacheOptions = {},
    retryNumber: number = 0,
    params?: HttpParams
  ): Observable<T> {
    const url = this.buildUrl(endpoint);

    if (cacheOptions.enabled) {
      const cachedValue = this.cacheService.get(url);
      if (cachedValue) {
        return of(cachedValue as T).pipe(take(1));
      }
    }

    const request$ = this.httpClient.get<T>(url, {
      params,
      context: new HttpContext()
        .set(CACHE_ENABLED, cacheOptions.enabled ?? false)
        .set(CACHE_MINUTES_TO_EXPIRE, cacheOptions.minutesToExpire ?? 10),
    });

    const retried$ =
      retryNumber > 0 ? request$.pipe(retry(retryNumber)) : request$;

    return retried$.pipe(
      tap((data) => {
        if (cacheOptions.enabled) {
          this.cacheService.set(
            url,
            data,
            cacheOptions.minutesToExpire ?? 10
          );
        }
      }),
      take(1)
    );
  }

  patch<T>(
    endpoint: string,
    payload: unknown,
    headers?: HttpHeaders | { [header: string]: string | string[] }
  ): Observable<T> {
    return this.httpClient
      .patch<T>(this.buildUrl(endpoint), payload, { headers })
      .pipe(take(1));
  }

  post<T>(
    endpoint: string,
    payload: unknown,
    retryNumber: number = 0,
    headers?: HttpHeaders | { [header: string]: string | string[] }
  ): Observable<T> {
    const request$ = this.httpClient.post<T>(
      this.buildUrl(endpoint),
      payload,
      { headers }
    );
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

  invalidateCache(endpoint: string): void {
    this.cacheService.remove(this.buildUrl(endpoint));
  }
}
