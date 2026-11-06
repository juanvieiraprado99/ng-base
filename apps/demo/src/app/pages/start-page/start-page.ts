import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Language, usePageTitle } from '@i18n/language';
import { CodeBlock } from '@shared/code-block/code-block';
import { RichText } from '@shared/rich-text/rich-text';

@Component({
  selector: 'app-start-page',
  templateUrl: './start-page.html',
  styleUrl: './start-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CodeBlock, RichText],
})
export class StartPage {
  protected readonly t = inject(Language).t;

  constructor() {
    usePageTitle(() => `${this.t().start.pageTitle} · ngx-base-cli`);
  }
}
