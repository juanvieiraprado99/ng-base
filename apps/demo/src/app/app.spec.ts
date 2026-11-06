import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { CONTENT } from '@content/content';
import { MODULE_IDS } from '@content/docs-data';
import { LANGS } from '@i18n/lang';
import { routes } from './app.routes';
import { BASE_API_URL } from './core/tokens/api-tokens';

describe('docs site', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_API_URL, useValue: 'https://registry.npmjs.org' },
      ],
    });
  });

  async function open(url: string): Promise<HTMLElement> {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  it('redirects the root to English', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(
      CONTENT.en.home.title,
    );
  });

  it.each(LANGS)('renders the home page in %s', async (lang) => {
    const page = await open(`/${lang}`);
    expect(page.querySelector('h1')?.textContent).toBe(CONTENT[lang].home.title);
  });

  it.each(MODULE_IDS)('renders the %s module page', async (id) => {
    const page = await open(`/en/modules/${id}`);
    expect(page.querySelector('h1')?.textContent).toBe(id);
  });

  it('falls back to the not-found page for unknown modules', async () => {
    const page = await open('/en/modules/nope');
    expect(page.querySelector('h1')?.textContent).toBe(
      CONTENT.en.notFound.title,
    );
  });

  it('lists every config property from the CLI schema', async () => {
    const page = await open('/en/config');
    const names = [...page.querySelectorAll('tbody th code')].map(
      (el) => el.textContent,
    );
    expect(names).toContain('outputDir');
    expect(names).toContain('modules');
  });
});
