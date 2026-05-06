import { Routes } from '@angular/router';

export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('@layout/public/public.component').then(
        (c) => c.PublicComponent,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('@pages/landing-page/landing-page.component').then(
            (c) => c.LandingPageComponent,
          ),
      },
    ],
  },
];
