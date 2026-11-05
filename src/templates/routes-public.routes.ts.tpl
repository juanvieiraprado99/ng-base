import { Routes } from '@angular/router';

export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('{{IMPORT_LAYOUT_PUBLIC}}').then((c) => c.{{LAYOUT_PUBLIC_CLASS}}),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('{{IMPORT_LANDING_PAGE}}').then((c) => c.{{LANDING_PAGE_CLASS}}),
      },
    ],
  },
];
