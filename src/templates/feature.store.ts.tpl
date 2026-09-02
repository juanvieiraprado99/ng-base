import { computed, {{SERVICE_DECORATOR_IMPORT}}, signal } from '@angular/core';

{{SERVICE_DECORATOR}}
export class {{CLASS_NAME}} {
  private readonly _loading = signal(false);

  readonly loading = this._loading.asReadonly();
  readonly ready = computed(() => !this._loading());

  setLoading(value: boolean): void {
    this._loading.set(value);
  }
}
