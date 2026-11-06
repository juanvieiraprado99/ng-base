import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LANG_NAME, LANGS } from '@i18n/lang';
import { Language } from '@i18n/language';
import { ZardButtonComponent } from '@/shared/components/button';

@Component({
  selector: 'app-lang-switch',
  templateUrl: './lang-switch.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ZardButtonComponent],
})
export class LangSwitch {
  protected readonly language = inject(Language);
  protected readonly langs = LANGS;
  protected readonly names = LANG_NAME;
}
