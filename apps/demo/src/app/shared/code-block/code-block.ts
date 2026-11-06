import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { Language } from '@i18n/language';

@Component({
  selector: 'app-code-block',
  templateUrl: './code-block.html',
  styleUrl: './code-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodeBlock {
  protected readonly t = inject(Language).t;

  readonly code = input.required<string>();
  /** Shown above the code, for example a file name. */
  readonly label = input<string>();

  protected readonly copied = signal(false);

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      // Clipboard can be blocked; the text stays selectable.
    }
  }
}
