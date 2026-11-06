import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideMoon, lucideSun } from '@ng-icons/lucide';
import { Language } from '@i18n/language';
import { ZardButtonComponent } from '@/shared/components/button';
import { Theme } from './theme';

@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ZardButtonComponent, NgIcon],
  viewProviders: [provideIcons({ lucideMoon, lucideSun })],
})
export class ThemeToggle {
  protected readonly theme = inject(Theme);
  protected readonly t = inject(Language).t;
}
