import {
  HttpClient,
  HttpHeaders,
  HttpResourceOptions,
  HttpResourceRef,
  httpResource,
} from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable, retry, take } from "rxjs";
import { BASE_API_URL } from "./cache.service";

@Injectable({
  providedIn: "root",
})
export class BaseService {
  private readonly httpClient = inject(HttpClient);
  private readonly baseApiUrl = inject(BASE_API_URL, { optional: true });

  private buildUrl(endpoint: string): string {
    return this.baseApiUrl ? `${this.baseApiUrl}${endpoint}` : endpoint;
  }

  get<T>(
    urlFactory: () => string | undefined,
    options?: HttpResourceOptions<T>
  ): HttpResourceRef<T> {
    return httpResource<T>(urlFactory, options);
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
}
