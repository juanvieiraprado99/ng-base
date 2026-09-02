import {
  HttpClient,
  HttpHeaders,
  HttpResourceOptions,
  HttpResourceRef,
  httpResource,
} from '@angular/common/http';
import { inject, {{SERVICE_DECORATOR_IMPORT}} } from '@angular/core';
import { Observable, retry, take } from 'rxjs';
import { BASE_API_URL } from './cache.service';

{{SERVICE_DECORATOR}}
export class BaseService {
  private readonly httpClient = inject(HttpClient);
  private readonly baseApiUrl = inject(BASE_API_URL, { optional: true });

  protected buildUrl(endpoint: string): string {
    return this.baseApiUrl ? `${this.baseApiUrl}${endpoint}` : endpoint;
  }

  /**
   * Reactive GET backed by `httpResource`.
   *
   * `endpointFactory` returns an endpoint *relative to* BASE_API_URL and may
   * read signals: when one of them changes the request is re-issued and the
   * stale response is discarded (switchMap semantics). Return `undefined` to
   * leave the resource idle.
   *
   * See https://angular.dev/guide/signals/resource
   */
  get<T>(
    endpointFactory: () => string | undefined,
    options?: HttpResourceOptions<T, unknown>,
  ): HttpResourceRef<T | undefined> {
    return httpResource<T>(() => {
      const endpoint = endpointFactory();
      return endpoint === undefined ? undefined : this.buildUrl(endpoint);
    }, options);
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
}
