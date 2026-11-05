import { Routes } from '@angular/router';
import { authGuard } from '{{IMPORT_AUTH_GUARD}}';

export const PRIVATE_ROUTES: Routes = [
  {
    path: 'app',
    canMatch: [authGuard],
    loadComponent: () =>
      import('{{IMPORT_LAYOUT_PRIVATE}}').then((c) => c.{{LAYOUT_PRIVATE_CLASS}}),
    children: [],
  },
];
