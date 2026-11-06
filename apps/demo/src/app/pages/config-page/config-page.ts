import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import schema from 'ngx-base-cli/schema.json';
import { Language, usePageTitle } from '@i18n/language';
import { ZardTableImports } from '@/shared/components/table';
import { RichText } from '@shared/rich-text/rich-text';

interface SchemaProperty {
  type: string;
  enum?: string[];
  default?: unknown;
  items?: { enum?: string[] };
}

/** One table row, built from the CLI's own schema.json so the docs cannot drift from CONFIG_FIELDS. */
function describe(name: string, property: SchemaProperty) {
  const options = property.enum ?? property.items?.enum;
  const type = options
    ? `${property.type === 'array' ? 'array of ' : ''}${options.join(' | ')}`
    : property.type;
  return {
    name,
    type,
    default: JSON.stringify(property.default ?? null),
  };
}

@Component({
  selector: 'app-config-page',
  templateUrl: './config-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RichText, ZardTableImports],
})
export class ConfigPage {
  protected readonly t = inject(Language).t;

  protected readonly rows = Object.entries(
    schema.properties as Record<string, SchemaProperty>,
  )
    .filter(([name]) => name !== '$schema')
    .map(([name, property]) => describe(name, property));

  constructor() {
    usePageTitle(() => `${this.t().config.pageTitle} · ngx-base-cli`);
  }
}
