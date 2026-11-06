import { CanMatchFn, Routes } from '@angular/router';
import { isModuleId } from '@content/docs-data';
import { langGuard } from '@i18n/lang-guard';

/** Matches `modules/<id>` only for modules that exist. */
const moduleGuard: CanMatchFn = (_route, segments) =>
  isModuleId(segments[1]?.path);

export const PUBLIC_ROUTES: Routes = [
  {
    path: ':lang',
    canMatch: [langGuard],
    loadComponent: () =>
      import('@layout/public/public-layout').then((c) => c.PublicLayout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('@pages/landing-page/landing-page').then((c) => c.LandingPage),
      },
      {
        path: 'start',
        loadComponent: () =>
          import('@pages/start-page/start-page').then((c) => c.StartPage),
      },
      {
        path: 'concepts',
        loadComponent: () =>
          import('@pages/concepts-page/concepts-page').then(
            (c) => c.ConceptsPage,
          ),
      },
      { path: 'modules', pathMatch: 'full', redirectTo: 'modules/core' },
      {
        path: 'modules/:id',
        canMatch: [moduleGuard],
        loadComponent: () =>
          import('@pages/module-page/module-page').then((c) => c.ModulePage),
      },
      {
        path: 'commands',
        loadComponent: () =>
          import('@pages/commands-page/commands-page').then(
            (c) => c.CommandsPage,
          ),
      },
      {
        path: 'config',
        loadComponent: () =>
          import('@pages/config-page/config-page').then((c) => c.ConfigPage),
      },
    ],
  },
];
