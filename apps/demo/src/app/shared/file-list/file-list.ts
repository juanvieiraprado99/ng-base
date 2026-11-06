import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FileEntry } from '@content/docs-data';
import { Language } from '@i18n/language';

@Component({
  selector: 'app-file-list',
  templateUrl: './file-list.html',
  styleUrl: './file-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileList {
  protected readonly t = inject(Language).t;

  readonly files = input.required<FileEntry[]>();

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
