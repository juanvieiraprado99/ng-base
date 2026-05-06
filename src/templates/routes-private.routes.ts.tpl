import { Routes } from '@angular/router';

export const PRIVATE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('@layout/private/private.component').then(
        (c) => c.PrivateComponent,
      ),
    children: [],
  },
];
