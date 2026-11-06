import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MODULES, ModuleId } from '@content/docs-data';
import { Language, usePageTitle } from '@i18n/language';
import { CodeBlock } from '@shared/code-block/code-block';
import { FileList } from '@shared/file-list/file-list';
import { RichText } from '@shared/rich-text/rich-text';

@Component({
  selector: 'app-module-page',
  templateUrl: './module-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CodeBlock, FileList, RichText],
})
export class ModulePage {
  protected readonly t = inject(Language).t;

  /** Bound from the `:id` route parameter; the route only matches known modules. */
  readonly id = input.required<ModuleId>();

  protected readonly data = computed(() => MODULES[this.id()]);
  protected readonly text = computed(() => this.t().modules.items[this.id()]);

  constructor() {
    usePageTitle(
      () => `${this.t().modules.pageTitle(this.id())} · ngx-base-cli`,
    );
  }
}
