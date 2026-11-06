export const LANGS = ['en', 'pt'] as const;

export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = 'en';

/** Value for the `lang` attribute of the document. */
export const HTML_LANG: Record<Lang, string> = {
  en: 'en',
  pt: 'pt-BR',
};

/** Names shown in the language switch, written in their own language. */
export const LANG_NAME: Record<Lang, string> = {
  en: 'English',
  pt: 'Português',
};

export function isLang(value: unknown): value is Lang {
  return LANGS.includes(value as Lang);
}
