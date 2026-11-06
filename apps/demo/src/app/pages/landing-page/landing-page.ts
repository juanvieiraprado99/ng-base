import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GITHUB_URL, MODULES } from '@content/docs-data';
import { Language, usePageTitle } from '@i18n/language';
import { FileList } from '@shared/file-list/file-list';
import { RichText } from '@shared/rich-text/rich-text';
import { TerminalDemo } from '@shared/terminal-demo/terminal-demo';

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FileList, RichText, TerminalDemo],
})
export class LandingPage {
  protected readonly language = inject(Language);
  protected readonly t = this.language.t;

  protected readonly githubUrl = GITHUB_URL;
  protected readonly sourceUrl = `${GITHUB_URL}/tree/main/apps/demo`;
  protected readonly coreFiles = MODULES.core.files;

  constructor() {
    usePageTitle(() => this.t().home.pageTitle);
  }
}
