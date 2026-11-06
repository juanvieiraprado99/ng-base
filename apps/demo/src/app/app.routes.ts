import { Routes } from '@angular/router';
import { DEFAULT_LANG } from '@i18n/lang';
import { PUBLIC_ROUTES } from './routes/public.routes';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: DEFAULT_LANG },
  ...PUBLIC_ROUTES,
  {
    path: '**',
    loadComponent: () =>
      import('@pages/not-found-page/not-found-page').then(
        (c) => c.NotFoundPage,
      ),
  },
];
