import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Language } from '@i18n/language';
import { Theme } from './theme';

@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.html',
  styleUrl: './theme-toggle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggle {
  protected readonly theme = inject(Theme);
  protected readonly t = inject(Language).t;
}
