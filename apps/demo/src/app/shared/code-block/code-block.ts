import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideCheck, lucideCopy } from '@ng-icons/lucide';
import { Language } from '@i18n/language';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardSonnerService } from '@/shared/components/sonner';
import { ZardTabsImports } from '@/shared/components/tabs/tabs.imports';

const RUNNERS = [
  { label: 'npm', command: 'npx' },
  { label: 'pnpm', command: 'pnpm dlx' },
  { label: 'yarn', command: 'yarn dlx' },
  { label: 'bun', command: 'bunx' },
] as const;

const NPX_PREFIX = 'npx ngx-base-cli';

@Component({
  selector: 'app-code-block',
  templateUrl: './code-block.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, ZardButtonComponent, ZardTabsImports, NgIcon],
  viewProviders: [provideIcons({ lucideCheck, lucideCopy })],
})
export class CodeBlock {
  private readonly toast = inject(ZardSonnerService);
  protected readonly t = inject(Language).t;

  readonly code = input.required<string>();
  /** Shown above the code, for example a file name. */
  readonly label = input<string>();

  /** A `npx ngx-base-cli ...` command gets one tab per package manager runner. */
  protected readonly variants = computed(() => {
    const code = this.code();
    if (!code.startsWith(NPX_PREFIX)) return null;
    return RUNNERS.map((runner) => ({
      label: runner.label,
      code: code.replace('npx', runner.command),
    }));
  });

  protected readonly copied = signal(false);

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      this.toast.success(this.t().ui.copied);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      // Clipboard can be blocked; the text stays selectable.
    }
  }
}
