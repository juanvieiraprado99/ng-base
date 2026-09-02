import { {{CHANGE_DETECTION_IMPORT}}Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-private',
  templateUrl: './private.component.html',
{{CHANGE_DETECTION_FIELD}}  imports: [RouterOutlet],
})
export class PrivateComponent {}
