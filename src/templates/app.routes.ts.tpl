import { Routes } from '@angular/router';
import { PRIVATE_ROUTES } from './routes/private.routes';
import { PUBLIC_ROUTES } from './routes/public.routes';

export const routes: Routes = [
  ...PUBLIC_ROUTES,
  ...PRIVATE_ROUTES,
];
