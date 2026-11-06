import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

/** Light/dark theme. The saved choice is applied before first paint by a script in index.html. */
@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly document = inject(DOCUMENT);
  readonly dark = signal(false);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const saved = this.document.documentElement.dataset['theme'];
    this.dark.set(
      saved
        ? saved === 'dark'
        : (globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ??
            false),
    );
  }

  toggle(): void {
    const next = !this.dark();
    this.dark.set(next);
    const value = next ? 'dark' : 'light';
    this.document.documentElement.dataset['theme'] = value;
    try {
      localStorage.setItem('theme', value);
    } catch {
      // Storage can be blocked; the choice then lasts for this visit only.
    }
  }
}
