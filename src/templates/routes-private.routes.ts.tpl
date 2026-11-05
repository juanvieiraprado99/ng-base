import { Routes } from '@angular/router';
{{#if GUARD}}
import { authGuard } from '{{IMPORT_AUTH_GUARD}}';
{{/if}}

export const PRIVATE_ROUTES: Routes = [
  {
    path: 'app',
{{#if GUARD}}
    canMatch: [authGuard],
{{/if}}
{{#if NO_GUARD}}
    // TODO: protect this route, e.g. `ng-base add auth` → canMatch: [authGuard]
{{/if}}
    loadComponent: () =>
      import('{{IMPORT_LAYOUT_PRIVATE}}').then((c) => c.{{LAYOUT_PRIVATE_CLASS}}),
    children: [],
  },
];
