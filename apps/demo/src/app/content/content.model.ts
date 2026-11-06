import { MODULE_IDS, ModuleId } from './docs-data';

export interface Table {
  head: string[];
  rows: string[][];
}

export interface Section {
  title: string;
  /** Paragraphs. `backticks` render as inline code. */
  body: string[];
  code?: string;
  table?: Table;
}

export interface Step {
  title: string;
  body: string;
  code: string;
}

export interface ModuleText {
  title: string;
  summary: string;
  wiring: string;
  usage: string[];
}

export interface CommandText {
  title: string;
  body: string;
}

/** Everything a reader sees, per language. Both languages share this type, so the compiler enforces parity. */
export interface Content {
  ui: {
    skipToContent: string;
    menu: string;
    docsNav: string;
    language: string;
    switchToLanguage: string;
    themeToLight: string;
    themeToDark: string;
    copy: string;
    copied: string;
    github: string;
    latestVersion: string;
    files: string;
    filesState: { created: string; patched: string; yours: string };
  };
  nav: {
    start: string;
    concepts: string;
    modules: string;
    commands: string;
    config: string;
  };
  home: {
    pageTitle: string;
    title: string;
    lead: string;
    ctaStart: string;
    ctaGithub: string;
    terminalLabel: string;
    whyTitle: string;
    why: { title: string; body: string }[];
    filesTitle: string;
    filesLead: string;
    legend: string;
    builtWithTitle: string;
    builtWith: string;
    builtWithLink: string;
  };
  start: {
    pageTitle: string;
    title: string;
    lead: string;
    prerequisitesTitle: string;
    prerequisites: string[];
    steps: Step[];
    ciTitle: string;
    ciBody: string;
    ciCode: string;
  };
  concepts: {
    pageTitle: string;
    title: string;
    lead: string;
    sections: Section[];
  };
  modules: {
    pageTitle: (module: string) => string;
    addHeading: string;
    filesHeading: string;
    wiringHeading: string;
    usageHeading: string;
    codeHeading: string;
    items: Record<ModuleId, ModuleText>;
  };
  commands: {
    pageTitle: string;
    title: string;
    lead: string;
    items: CommandText[];
    flagsTitle: string;
    flagsLead: string;
    flagHead: string;
    flagDescriptionHead: string;
    flags: Record<string, string>;
  };
  config: {
    pageTitle: string;
    title: string;
    lead: string;
    propertyHead: string;
    typeHead: string;
    defaultHead: string;
    descriptionHead: string;
    fields: Record<string, string>;
  };
  notFound: {
    title: string;
    body: string;
    link: string;
  };
}

export { MODULE_IDS };
