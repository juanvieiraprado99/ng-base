import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: '{{SELECTOR}}',
  templateUrl: '{{TEMPLATE_URL}}',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class {{CLASS_NAME}} {}
