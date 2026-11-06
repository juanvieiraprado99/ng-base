import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: '{{SELECTOR}}',
  templateUrl: '{{TEMPLATE_URL}}',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
})
export class {{CLASS_NAME}} {}
