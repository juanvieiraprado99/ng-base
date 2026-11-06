import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

/** Light/dark theme. The saved choice is applied before first paint by a script in index.html. */
@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly document = inject(DOCUMENT);
  readonly dark = signal(false);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    this.dark.set(this.document.documentElement.classList.contains('dark'));
  }

  toggle(): void {
    const next = !this.dark();
    this.dark.set(next);
    this.document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      // Storage can be blocked; the choice then lasts for this visit only.
    }
  }
}
