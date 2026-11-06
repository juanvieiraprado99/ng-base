import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { COMMAND_LINES, INIT_FLAGS } from '@content/docs-data';
import { Language, usePageTitle } from '@i18n/language';
import { CodeBlock } from '@shared/code-block/code-block';
import { ZardTableImports } from '@/shared/components/table';
import { RichText } from '@shared/rich-text/rich-text';

@Component({
  selector: 'app-commands-page',
  templateUrl: './commands-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CodeBlock, RichText, ZardTableImports],
})
export class CommandsPage {
  protected readonly t = inject(Language).t;
  protected readonly lines = COMMAND_LINES;
  protected readonly flags = INIT_FLAGS;

  constructor() {
    usePageTitle(() => `${this.t().commands.pageTitle} · ngx-base-cli`);
  }
}
