import { computed, effect, inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { CONTENT } from '@content/content';
import { DEFAULT_LANG, HTML_LANG, isLang, Lang } from './lang';

/** Current language, taken from the first segment of the URL (`/en/...`, `/pt/...`). */
@Injectable({ providedIn: 'root' })
export class Language {
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly lang = computed<Lang>(() => {
    const first = this.url().split(/[/?#]/)[1];
    return isLang(first) ? first : DEFAULT_LANG;
  });

  readonly t = computed(() => CONTENT[this.lang()]);

  /** The current page address in another language. */
  hrefIn(target: Lang): string {
    const rest = this.url().replace(/^\/[^/?#]*/, '');
    return `/${target}${rest}`;
  }
}

/** Sets the document title (and the `lang` attribute) for the current page. */
export function usePageTitle(title: () => string): void {
  const language = inject(Language);
  const titleService = inject(Title);
  const document = inject(DOCUMENT);

  effect(() => {
    titleService.setTitle(title());
    document.documentElement.lang = HTML_LANG[language.lang()];
  });
}
