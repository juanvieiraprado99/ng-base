import { RenderMode, ServerRoute } from '@angular/ssr';
import { MODULE_IDS } from '@content/docs-data';
import { LANGS } from '@i18n/lang';

const languages = async () => LANGS.map((lang) => ({ lang }));

/** Every page of every language is prerendered to static HTML (GitHub Pages has no server). */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  ...['', '/start', '/concepts', '/modules', '/commands', '/config'].map(
    (page): ServerRoute => ({
      path: `:lang${page}`,
      renderMode: RenderMode.Prerender,
      getPrerenderParams: languages,
    }),
  ),
  {
    path: ':lang/modules/:id',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () =>
      LANGS.flatMap((lang) => MODULE_IDS.map((id) => ({ lang, id }))),
  },
  // Unknown addresses: the pages workflow copies index.csr.html to 404.html.
  { path: '**', renderMode: RenderMode.Client },
];
