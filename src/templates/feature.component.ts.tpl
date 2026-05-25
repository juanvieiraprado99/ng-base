import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: '{{SELECTOR}}',
{{TEMPLATE_FIELD}}{{STYLE_FIELD}}  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class {{CLASS_NAME}} {}
