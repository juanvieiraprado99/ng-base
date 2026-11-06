import { afterNextRender, inject, Injectable, signal } from '@angular/core';
import { ApiClient } from '@core/services/api-client';

/** Latest published version of ngx-base-cli, read from the npm registry through the generated ApiClient. */
@Injectable({ providedIn: 'root' })
export class LatestVersion {
  private readonly api = inject(ApiClient);

  readonly version = signal<string | null>(null);

  constructor() {
    afterNextRender(() => {
      this.api
        .get<{ version: string }>('/ngx-base-cli/latest', {
          cache: { ttlMinutes: 60 },
        })
        .subscribe({
          next: (pkg) => this.version.set(pkg.version),
          error: () => {
            // The badge is a nicety: stay silent if the registry is unreachable.
          },
        });
    });
  }
}
