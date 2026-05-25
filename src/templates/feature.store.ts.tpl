import { computed, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class {{CLASS_NAME}} {
  private readonly _loading = signal(false);

  readonly loading = this._loading.asReadonly();
  readonly ready = computed(() => !this._loading());

  setLoading(value: boolean): void {
    this._loading.set(value);
  }
}
