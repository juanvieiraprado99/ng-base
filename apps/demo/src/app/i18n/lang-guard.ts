import { CanMatchFn } from '@angular/router';
import { isLang } from './lang';

/** Lets the `:lang` route match only the supported languages. */
export const langGuard: CanMatchFn = (_route, segments) =>
  isLang(segments[0]?.path);
