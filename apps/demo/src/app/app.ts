import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ZardSonnerComponent } from '@/shared/components/sonner';

@Component({
  imports: [RouterOutlet, ZardSonnerComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
