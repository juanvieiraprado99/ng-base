import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { GITHUB_URL, MODULE_IDS, NPM_URL } from '@content/docs-data';
import { Language } from '@i18n/language';
import { LangSwitch } from '@shared/lang-switch/lang-switch';
import { LatestVersion } from '@shared/latest-version/latest-version';
import { ThemeToggle } from '@shared/theme-toggle/theme-toggle';

@Component({
  selector: 'app-public-layout',
  templateUrl: './public-layout.html',
  styleUrl: './public-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LangSwitch,
    ThemeToggle,
  ],
})
export class PublicLayout {
  protected readonly language = inject(Language);
  protected readonly version = inject(LatestVersion).version;

  protected readonly moduleIds = MODULE_IDS;
  protected readonly githubUrl = GITHUB_URL;
  protected readonly npmUrl = NPM_URL;

  protected readonly menuOpen = signal(false);
}
