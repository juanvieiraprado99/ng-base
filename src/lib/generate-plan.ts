import path from "node:path";
import type { NgxBaseCliConfig, StorageEngine } from "./config.js";
import { importBetweenFiles, toPosix } from "./import-paths.js";
import {
  type CoreFiles,
  coreFiles,
  type StructureComponent,
  structureNames,
} from "./naming-style.js";
import { DEFAULT_WORKSPACE, type Workspace } from "./workspace.js";

export interface GenerationTarget {
  outPath: string;
  template: string;
  vars: Record<string, string>;
  /** Conteúdo gerado sem template (ex.: barrel). */
  rawContent?: string;
  /** Quando true, outPath é uma pasta a criar (sem ficheiro/placeholder). */
  dirOnly?: boolean;
  /**
   * Quando true, o ficheiro só é escrito se ainda não existir (ex.: app.html,
   * app.routes.ts do projeto). Ficheiros existentes nunca são sobrescritos nem
   * rastreados no manifest.
   */
  createOnly?: boolean;
}

/** Aliases (alias → directory relative to project root) used when importStyle is "alias". */
export function pathAliases(
  config: NgxBaseCliConfig,
  ws: Workspace = DEFAULT_WORKSPACE,
): Record<string, string> {
  return {
    "@core": config.outputDir,
    "@layout": `${ws.appDir}/layout`,
    "@pages": `${ws.appDir}/pages`,
    "@shared": `${ws.appDir}/shared`,
  };
}

/** CACHE_STORAGE factory expression for the configured engine. */
export function storageFactoryFor(engine: StorageEngine): string {
  switch (engine) {
    case "sessionStorage":
      return 'browserStorage("session")';
    case "memory":
      return "memoryStorage()";
    default:
      return 'browserStorage("local")';
  }
}

export interface InterceptorBinding {
  name: string;
  /** Path relative to outputDir. */
  file: string;
}

/**
 * Interceptors to register, in `withInterceptors([...])` order. The cache
 * interceptor is always present and goes last (closest to the network).
 */
export function interceptorBindings(
  config: NgxBaseCliConfig,
): InterceptorBinding[] {
  const f = coreFiles(config.naming);
  const list: InterceptorBinding[] = [];
  if (config.generateAuthInterceptor)
    list.push({ name: "authInterceptor", file: f.authInterceptor });
  if (config.generateErrorInterceptor)
    list.push({ name: "errorInterceptor", file: f.errorInterceptor });
  if (config.generateLoggingInterceptor)
    list.push({ name: "loggingInterceptor", file: f.loggingInterceptor });
  list.push({ name: "cacheInterceptor", file: f.cacheInterceptor });
  return list;
}

/** Path (relative to outputDir) of the file that exports BASE_API_URL. */
export function apiTokensFile(config: NgxBaseCliConfig): string {
  return coreFiles(config.naming).apiTokens;
}

function buildEnvironmentTsContent(
  production: boolean,
  baseApiUrl: string,
): string {
  return [
    "export const environment = {",
    `  production: ${production},`,
    `  baseApiUrl: ${JSON.stringify(baseApiUrl)},`,
    "} as const;",
    "",
  ].join("\n");
}

/** `./x` specifier for a file in `services/`, from the services barrel. */
const barrelEntry = (servicesFile: string) =>
  `export * from './${path.posix.basename(servicesFile, ".ts")}';`;

function buildBarrelContent(f: CoreFiles, withAuthStore: boolean): string {
  const lines = [f.apiClient, f.cacheService, f.cacheStorage].map(barrelEntry);
  if (withAuthStore) lines.push(barrelEntry(f.authStore));
  return `${lines.join("\n")}\n`;
}

export function buildAppRoutesContent(): string {
  const lines = [
    "import { Routes } from '@angular/router';",
    "import { PRIVATE_ROUTES } from './routes/private.routes';",
    "import { PUBLIC_ROUTES } from './routes/public.routes';",
    "",
    "export const routes: Routes = [",
    "  ...PUBLIC_ROUTES,",
    "  ...PRIVATE_ROUTES,",
    "  { path: '**', redirectTo: '' },",
    "];",
  ];
  return `${lines.join("\n")}\n`;
}

/** Whether the auth store is part of the plan (needed by interceptor and guard). */
export function needsAuthStore(config: NgxBaseCliConfig): boolean {
  return config.generateAuthInterceptor || config.generateProjectStructure;
}

/** Whether LOGIN_ROUTE / FORBIDDEN_ROUTE tokens are part of the plan. */
export function needsRoutesTokens(config: NgxBaseCliConfig): boolean {
  return config.generateErrorInterceptor || config.generateProjectStructure;
}

/** Absolute paths of the core/structure files other targets import from. */
type PlanFiles = Record<
  | Exclude<
      keyof CoreFiles,
      "authInterceptor" | "errorInterceptor" | "loggingInterceptor"
    >
  | "layoutPrivate"
  | "layoutPublic"
  | "landingPage",
  string
>;

/** Everything a feature needs to describe its targets. */
export interface PlanContext {
  config: NgxBaseCliConfig;
  ws: Workspace;
  coreDir: string;
  appDir: string;
  environmentsDir: string;
  names: CoreFiles;
  structure: ReturnType<typeof structureNames>;
  files: PlanFiles;
  /** Absolute path of a core file. */
  core: (key: keyof CoreFiles) => string;
  /** Import specifier between two generated files (alias or relative). */
  importFor: (fromFile: string, toFile: string) => string;
  /** Template target; the shared IMPORT_* vars are computed for `outPath`. */
  target: (
    outPath: string,
    template: string,
    extraVars?: Record<string, string>,
  ) => GenerationTarget;
  raw: (
    outPath: string,
    content: string,
    createOnly?: boolean,
  ) => GenerationTarget;
  dir: (outPath: string) => GenerationTarget;
  /** .ts + .html for a layout/page component. */
  component: (
    c: StructureComponent,
    tsTemplate: string,
    htmlTemplate: string,
  ) => GenerationTarget[];
}

export interface FeatureSpec {
  id: string;
  enabled: (config: NgxBaseCliConfig) => boolean;
  targets: (ctx: PlanContext) => GenerationTarget[];
}

const always = () => true;

/**
 * What `init`/`update` generate, feature by feature, in output order. To add a
 * feature: add its template(s) under `src/templates/`, a config flag in
 * `CONFIG_FIELDS` (config.ts), and an entry here.
 */
export const FEATURES: readonly FeatureSpec[] = [
  {
    id: "environments",
    enabled: always,
    targets: ({ raw, environmentsDir, config }) => [
      raw(
        path.join(environmentsDir, "environment.ts"),
        buildEnvironmentTsContent(false, config.baseApiUrl),
      ),
      raw(
        path.join(environmentsDir, "environment.prod.ts"),
        buildEnvironmentTsContent(true, config.baseApiUrl),
      ),
    ],
  },
  {
    id: "http-core",
    enabled: always,
    targets: ({ target, files, config }) => [
      target(files.cacheInterface, "cache.interface.ts.tpl"),
      target(files.apiTokens, "api.tokens.ts.tpl"),
      target(files.cacheStorage, "cache.storage.ts.tpl", {
        STORAGE_FACTORY: storageFactoryFor(config.storageEngine),
      }),
      target(files.cacheService, "cache.service.ts.tpl"),
      target(files.apiClient, "api-client.ts.tpl", {
        HTTP_RESOURCE: String(config.useHttpResource),
      }),
      target(files.cacheInterceptor, "cache.interceptor.ts.tpl"),
    ],
  },
  {
    id: "routes-tokens",
    enabled: needsRoutesTokens,
    targets: ({ target, files }) => [
      target(files.routesTokens, "routes.tokens.ts.tpl"),
    ],
  },
  {
    id: "auth-store",
    enabled: needsAuthStore,
    targets: ({ target, files }) => [
      target(files.authStore, "auth-token.store.ts.tpl"),
    ],
  },
  {
    id: "barrel",
    enabled: (c) => c.generateBarrel,
    targets: ({ raw, coreDir, names, config }) => [
      raw(
        path.join(coreDir, "services/index.ts"),
        buildBarrelContent(names, needsAuthStore(config)),
      ),
    ],
  },
  {
    id: "auth-interceptor",
    enabled: (c) => c.generateAuthInterceptor,
    targets: ({ target, files, core }) => [
      target(files.authTokens, "auth.tokens.ts.tpl"),
      target(core("authInterceptor"), "auth.interceptor.ts.tpl"),
    ],
  },
  {
    id: "error-interceptor",
    enabled: (c) => c.generateErrorInterceptor,
    targets: ({ target, core }) => [
      target(core("errorInterceptor"), "error.interceptor.ts.tpl"),
    ],
  },
  {
    id: "logging-interceptor",
    enabled: (c) => c.generateLoggingInterceptor,
    targets: ({ target, core }) => [
      target(core("loggingInterceptor"), "logging.interceptor.ts.tpl"),
    ],
  },
  {
    id: "project-structure",
    enabled: (c) => c.generateProjectStructure,
    targets: (ctx) => {
      const { target, raw, dir, component, importFor, files, coreDir, appDir } =
        ctx;
      const { privateLayout, publicLayout, landingPage } = ctx.structure;
      const privateRoutes = path.join(appDir, "routes/private.routes.ts");
      const publicRoutes = path.join(appDir, "routes/public.routes.ts");
      return [
        ...["directives", "enum", "pipes", "utils"].map((d) =>
          dir(path.join(coreDir, d)),
        ),
        target(files.authGuard, "auth.guard.ts.tpl"),
        ...component(
          privateLayout,
          "layout-private.component.ts.tpl",
          "layout-private.component.html.tpl",
        ),
        dir(path.join(appDir, privateLayout.dir, "components")),
        ...component(
          publicLayout,
          "layout-public.component.ts.tpl",
          "layout-public.component.html.tpl",
        ),
        dir(path.join(appDir, publicLayout.dir, "components")),
        ...component(
          landingPage,
          "pages-landing-page.component.ts.tpl",
          "pages-landing-page.component.html.tpl",
        ),
        ...["components", "interfaces", "services"].map((d) =>
          dir(path.join(appDir, landingPage.dir, d)),
        ),
        target(privateRoutes, "routes-private.routes.ts.tpl", {
          IMPORT_AUTH_GUARD: importFor(privateRoutes, files.authGuard),
          IMPORT_LAYOUT_PRIVATE: importFor(privateRoutes, files.layoutPrivate),
          LAYOUT_PRIVATE_CLASS: privateLayout.className,
        }),
        target(publicRoutes, "routes-public.routes.ts.tpl", {
          IMPORT_LAYOUT_PUBLIC: importFor(publicRoutes, files.layoutPublic),
          IMPORT_LANDING_PAGE: importFor(publicRoutes, files.landingPage),
          LAYOUT_PUBLIC_CLASS: publicLayout.className,
          LANDING_PAGE_CLASS: landingPage.className,
        }),
        raw(path.join(appDir, "app.routes.ts"), buildAppRoutesContent(), true),
        dir(path.join(appDir, "shared")),
        raw(path.join(appDir, "app.html"), "<router-outlet />\n", true),
      ];
    },
  },
];

/** Ids of the features the config turns on, in output order. */
export function enabledFeatures(config: NgxBaseCliConfig): string[] {
  return FEATURES.filter((f) => f.enabled(config)).map((f) => f.id);
}

function createPlanContext(
  cwd: string,
  config: NgxBaseCliConfig,
  ws: Workspace,
): PlanContext {
  const coreDir = path.join(cwd, config.outputDir);
  const appDir = path.join(cwd, ws.appDir);
  const names = coreFiles(config.naming);
  const structure = structureNames(config.naming);

  const core = (key: keyof CoreFiles) => path.join(coreDir, names[key]);
  const structureFile = (c: StructureComponent, ext: string) =>
    path.join(appDir, c.dir, `${c.base}.${ext}`);

  const files: PlanFiles = {
    cacheInterface: core("cacheInterface"),
    apiTokens: core("apiTokens"),
    authTokens: core("authTokens"),
    routesTokens: core("routesTokens"),
    apiClient: core("apiClient"),
    cacheService: core("cacheService"),
    cacheStorage: core("cacheStorage"),
    authStore: core("authStore"),
    authGuard: core("authGuard"),
    cacheInterceptor: core("cacheInterceptor"),
    layoutPrivate: structureFile(structure.privateLayout, "ts"),
    layoutPublic: structureFile(structure.publicLayout, "ts"),
    landingPage: structureFile(structure.landingPage, "ts"),
  };

  const aliases = Object.entries(pathAliases(config, ws)).map(
    ([alias, dir]) => [alias, path.join(cwd, dir)] as const,
  );

  // With importStyle "alias", files under an aliased folder use the alias;
  // same-folder imports and everything else stay relative.
  const importFor = (fromFile: string, toFile: string): string => {
    if (
      config.importStyle === "alias" &&
      path.dirname(fromFile) !== path.dirname(toFile)
    ) {
      for (const [alias, dir] of aliases) {
        const rel = path.relative(dir, toFile);
        if (!rel.startsWith("..") && !path.isAbsolute(rel)) {
          return `${alias}/${toPosix(rel).replace(/\.ts$/, "")}`;
        }
      }
    }
    return importBetweenFiles(fromFile, toFile);
  };

  const coreVars = (fromFile: string): Record<string, string> => ({
    IMPORT_CACHE_INTERFACE: importFor(fromFile, files.cacheInterface),
    IMPORT_API_TOKENS: importFor(fromFile, files.apiTokens),
    IMPORT_AUTH_TOKENS: importFor(fromFile, files.authTokens),
    IMPORT_CACHE_SERVICE: importFor(fromFile, files.cacheService),
    IMPORT_CACHE_STORAGE: importFor(fromFile, files.cacheStorage),
    IMPORT_CACHE_INTERCEPTOR: importFor(fromFile, files.cacheInterceptor),
    IMPORT_ROUTES_TOKENS: importFor(fromFile, files.routesTokens),
    IMPORT_AUTH_STORE: importFor(fromFile, files.authStore),
  });

  const target: PlanContext["target"] = (
    outPath,
    template,
    extraVars = {},
  ) => ({
    outPath,
    template,
    vars: { ...coreVars(outPath), ...extraVars },
  });

  return {
    config,
    ws,
    coreDir,
    appDir,
    environmentsDir: path.join(cwd, ws.sourceRoot, "environments"),
    names,
    structure,
    files,
    core,
    importFor,
    target,
    raw: (outPath, rawContent, createOnly = false) => ({
      outPath,
      template: "",
      vars: {},
      rawContent,
      ...(createOnly ? { createOnly: true } : {}),
    }),
    dir: (outPath) => ({ outPath, template: "", vars: {}, dirOnly: true }),
    component: (c, tsTemplate, htmlTemplate) => [
      target(structureFile(c, "ts"), tsTemplate, {
        CLASS_NAME: c.className,
        SELECTOR: `${ws.prefix}-${c.selector}`,
        TEMPLATE_URL: `./${c.base}.html`,
      }),
      target(structureFile(c, "html"), htmlTemplate, {
        CLASS_NAME: c.className,
      }),
    ],
  };
}

export function buildGenerationTargets(
  cwd: string,
  config: NgxBaseCliConfig,
  ws: Workspace = DEFAULT_WORKSPACE,
): GenerationTarget[] {
  const ctx = createPlanContext(cwd, config, ws);
  return FEATURES.filter((f) => f.enabled(config)).flatMap((f) =>
    f.targets(ctx),
  );
}
