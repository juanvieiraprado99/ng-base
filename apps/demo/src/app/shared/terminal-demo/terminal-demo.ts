import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TERMINAL_COMMAND, TERMINAL_LINES } from '@content/docs-data';
import { Language } from '@i18n/language';

/** The home page's one animated moment. Pure CSS; the final state shows with reduced motion. */
@Component({
  selector: 'app-terminal-demo',
  templateUrl: './terminal-demo.html',
  styleUrl: './terminal-demo.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminalDemo {
  protected readonly t = inject(Language).t;
  protected readonly command = TERMINAL_COMMAND;
  protected readonly lines = TERMINAL_LINES;
}
