import { minLength, required, schema } from '@angular/forms/signals';

/** Shape backing {{FN_NAME}}. Replace these fields with your own. */
export interface {{MODEL_NAME}} {
  name: string;
}

/**
 * Reusable Signal Forms schema (stable since Angular 22).
 *
 * Bind it in a component with:
 *   protected readonly model = signal<{{MODEL_NAME}}>({ name: '' });
 *   protected readonly form = form(this.model, {{FN_NAME}});
 *
 * See https://angular.dev/guide/forms/signals/schemas
 */
export const {{FN_NAME}} = schema<{{MODEL_NAME}}>((path) => {
  required(path.name);
  minLength(path.name, 2);
});
