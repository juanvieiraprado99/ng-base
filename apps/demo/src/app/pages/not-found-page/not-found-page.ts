import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardEmptyComponent } from '@/shared/components/empty';
import { LANG_NAME, LANGS } from '@i18n/lang';
import { Language, usePageTitle } from '@i18n/language';

@Component({
  selector: 'app-not-found-page',
  templateUrl: './not-found-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ZardButtonComponent, ZardEmptyComponent],
})
export class NotFoundPage {
  protected readonly t = inject(Language).t;
  protected readonly langs = LANGS;
  protected readonly names = LANG_NAME;

  constructor() {
    usePageTitle(() => `${this.t().notFound.title} · ngx-base-cli`);
  }
}
