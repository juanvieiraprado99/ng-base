import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Language, usePageTitle } from '@i18n/language';
import { CodeBlock } from '@shared/code-block/code-block';
import { RichText } from '@shared/rich-text/rich-text';

@Component({
  selector: 'app-concepts-page',
  templateUrl: './concepts-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CodeBlock, RichText],
})
export class ConceptsPage {
  protected readonly t = inject(Language).t;

  constructor() {
    usePageTitle(() => `${this.t().concepts.pageTitle} · ngx-base-cli`);
  }
}
