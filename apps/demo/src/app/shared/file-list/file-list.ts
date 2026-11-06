import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FileEntry } from '@content/docs-data';
import { Language } from '@i18n/language';
import { ZardBadgeComponent, ZardBadgeTypeVariants } from '@/shared/components/badge';

@Component({
  selector: 'app-file-list',
  templateUrl: './file-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ZardBadgeComponent],
})
export class FileList {
  protected readonly t = inject(Language).t;

  readonly files = input.required<FileEntry[]>();

  /** The state is always spelled out in the badge text; the variant only adds emphasis. */
  protected readonly badge: Record<FileEntry['state'], ZardBadgeTypeVariants> = {
    created: 'default',
    patched: 'secondary',
    yours: 'outline',
  };

  protected readonly rows = computed(() =>
    this.files().map((file) => {
      const cut = file.path.lastIndexOf('/') + 1;
      return {
        dir: file.path.slice(0, cut),
        name: file.path.slice(cut),
        state: file.state,
      };
    }),
  );
}
