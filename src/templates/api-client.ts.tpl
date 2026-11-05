import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
{{#if HTTP_RESOURCE}}
  HttpResourceOptions,
  HttpResourceRef,
  httpResource,
{{/if}}
} from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { BASE_API_URL } from "{{IMPORT_API_TOKENS}}";
import { Observable, retry, throwError, timer } from "rxjs";
import {
  type CacheRequestOptions,
  withCache,
} from "{{IMPORT_CACHE_INTERCEPTOR}}";
import { CacheService } from "{{IMPORT_CACHE_SERVICE}}";

export type QueryParams =
  | HttpParams
  | Record<
      string,
      string | number | boolean | readonly (string | number | boolean)[]
    >;

export interface RequestOptions {
  params?: QueryParams;
  headers?: HttpHeaders | Record<string, string | string[]>;
  context?: HttpContext;
}

export interface GetOptions extends RequestOptions {
  /** Cache the response (`true` = 10 minutes). */
  cache?: boolean | CacheRequestOptions;
  /** Retries on network errors and 5xx only, with a 500 ms delay. */
  retry?: number;
}

/**
 * Thin HttpClient wrapper: prefixes BASE_API_URL and exposes cache/retry as
 * options. Inject it in feature services (composition, not inheritance):
 *
 * ```ts
 * @Injectable({ providedIn: "root" })
 * export class UserService {
 *   private readonly api = inject(ApiClient);
 *   list() { return this.api.get<User[]>("/users", { cache: true }); }
 * }
 * ```
 */
@Injectable({
  providedIn: "root",
})
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(CacheService);
  private readonly baseApiUrl = inject(BASE_API_URL, { optional: true });

  /** Absolute URL for an API-relative endpoint. */
  url(endpoint: string): string {
    return this.baseApiUrl ? `${this.baseApiUrl}${endpoint}` : endpoint;
  }

  get<T>(endpoint: string, options: GetOptions = {}): Observable<T> {
    const { cache, retry: retryCount = 0, ...request } = options;
    const context = cache
      ? withCache(cache === true ? {} : cache, request.context)
      : request.context;
    const request$ = this.http.get<T>(this.url(endpoint), {
      ...request,
      context,
    });
    return retryCount > 0
      ? request$.pipe(
          retry({ count: retryCount, delay: retryableDelay }),
        )
      : request$;
  }

  post<T>(
    endpoint: string,
    body: unknown,
    options: RequestOptions = {},
  ): Observable<T> {
    return this.http.post<T>(this.url(endpoint), body, options);
  }

  put<T>(
    endpoint: string,
    body: unknown,
    options: RequestOptions = {},
  ): Observable<T> {
    return this.http.put<T>(this.url(endpoint), body, options);
  }

  patch<T>(
    endpoint: string,
    body: unknown,
    options: RequestOptions = {},
  ): Observable<T> {
    return this.http.patch<T>(this.url(endpoint), body, options);
  }

  delete<T>(
    endpoint: string,
    options: RequestOptions & { body?: unknown } = {},
  ): Observable<T> {
    return this.http.delete<T>(this.url(endpoint), options);
  }
{{#if HTTP_RESOURCE}}

  /**
   * Reactive GET via httpResource. `endpoint` is re-evaluated when the signals it
   * reads change; return `undefined` to skip the request. Call it in an
   * injection context (e.g. a field initializer). Interceptors apply, so
   * `{ cache: true }` goes through the cache interceptor like `get()`.
   */
  resource<T>(
    endpoint: () => string | undefined,
    options: HttpResourceOptions<T, unknown> & {
      cache?: boolean | CacheRequestOptions;
    } = {},
  ): HttpResourceRef<T | undefined> {
    const { cache, ...resourceOptions } = options;
    return httpResource<T>(() => {
      const value = endpoint();
      if (value === undefined) return undefined;
      return {
        url: this.url(value),
        context: cache ? withCache(cache === true ? {} : cache) : undefined,
      };
    }, resourceOptions);
  }
{{/if}}

  /** Drops the cached GET response for `endpoint` with the same `params`. */
  invalidateCache(endpoint: string, params?: QueryParams): void {
    const url = this.url(endpoint);
    const query = (
      params instanceof HttpParams
        ? params
        : new HttpParams({ fromObject: params ?? {} })
    ).toString();
    if (!query) {
      this.cache.remove(url);
      return;
    }
    const qIdx = url.indexOf("?");
    const sep = qIdx === -1 ? "?" : qIdx < url.length - 1 ? "&" : "";
    this.cache.remove(url + sep + query);
  }
}

/** Retry only transient failures (network / 5xx). */
function retryableDelay(error: unknown): Observable<number> {
  const transient =
    error instanceof HttpErrorResponse &&
    (error.status === 0 || error.status >= 500);
  return transient ? timer(500) : throwError(() => error);
}
