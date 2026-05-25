import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: '{{SELECTOR}}',
  templateUrl: './{{FILE_BASE}}.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class {{CLASS_NAME}} {}
