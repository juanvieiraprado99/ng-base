import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { lucideMenu } from '@ng-icons/lucide';
import { GITHUB_URL, MODULE_IDS, NPM_URL } from '@content/docs-data';
import { Language } from '@i18n/language';
import { LangSwitch } from '@shared/lang-switch/lang-switch';
import { LatestVersion } from '@shared/latest-version/latest-version';
import { ThemeToggle } from '@shared/theme-toggle/theme-toggle';
import { ZardBadgeComponent } from '@/shared/components/badge';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardSheetImports } from '@/shared/components/sheet';
import { ZardTooltipImports } from '@/shared/components/tooltip';

@Component({
  selector: 'app-public-layout',
  templateUrl: './public-layout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    NgIcon,
    LangSwitch,
    ThemeToggle,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardSheetImports,
    ZardTooltipImports,
  ],
  viewProviders: [provideIcons({ lucideMenu })],
})
export class PublicLayout {
  protected readonly language = inject(Language);
  protected readonly version = inject(LatestVersion).version;

  protected readonly moduleIds = MODULE_IDS;
  protected readonly githubUrl = GITHUB_URL;
  protected readonly npmUrl = NPM_URL;

  protected readonly menuOpen = signal(false);
}
