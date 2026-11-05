import path from "node:path";
import {
  MODULE_IDS,
  type ModuleId,
  type NgBaseConfig,
  type StorageEngine,
} from "./config.js";
import { importBetweenFiles, toPosix } from "./import-paths.js";
import {
  type CoreFiles,
  coreFiles,
  type StructureComponent,
  structureNames,
} from "./naming-style.js";
import { DEFAULT_WORKSPACE, type Workspace } from "./workspace.js";

/** What `init` (core) and `add <module>` install. */
export type InstallId = "core" | ModuleId;

export interface GenerationTarget {
  outPath: string;
  template: string;
  vars: Record<string, string>;
  /** Content generated without a template (e.g. environment files). */
  rawContent?: string;
  /**
   * Project files the module only creates when missing (app.html,
   * app.routes.ts); an existing one is patched or left alone, never replaced.
   */
  createOnly?: boolean;
}

/** Ids installed in a project: the core plus the configured modules. */
export function installedIds(config: NgBaseConfig): InstallId[] {
  return ["core", ...config.modules];
}

/** Aliases (alias → directory relative to project root) for importStyle "alias". */
export function pathAliases(
  config: NgBaseConfig,
  ws: Workspace = DEFAULT_WORKSPACE,
  ids: readonly InstallId[] = installedIds(config),
): Record<string, string> {
  const aliases: Record<string, string> = { "@core": config.outputDir };
  if (ids.includes("layout")) {
    aliases["@layout"] = `${ws.appDir}/layout`;
    aliases["@pages"] = `${ws.appDir}/pages`;
    aliases["@shared"] = `${ws.appDir}/shared`;
  }
  return aliases;
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

/** Absolute paths of the files other targets import from. */
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

/** Everything a module needs to describe its targets. */
export interface PlanContext {
  config: NgBaseConfig;
  ws: Workspace;
  /** Modules present after this install (core + configured + requested). */
  installed: ReadonlySet<InstallId>;
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
  /** .ts + .html for a layout/page component. */
  component: (
    c: StructureComponent,
    tsTemplate: string,
    htmlTemplate: string,
  ) => GenerationTarget[];
}

export interface ModuleSpec {
  id: InstallId;
  title: string;
  description: string;
  /**
   * Interceptor this module registers in `withInterceptors([...])`. `order`
   * sets its position (ascending); the cache interceptor is last, closest to
   * the network.
   */
  interceptor?: { name: string; file: keyof CoreFiles; order: number };
  targets: (ctx: PlanContext) => GenerationTarget[];
  /** Next steps printed after install. */
  notes: string[];
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

/** Path of the private routes file (layout module). */
export function privateRoutesFile(appDir: string): string {
  return path.join(appDir, "routes/private.routes.ts");
}

/**
 * The installable units, in install/output order. Each module imports only
 * from the core and from itself, so they can be added in any order and the
 * copied code stays independent. To add one: templates under `src/templates/`,
 * an id in `MODULE_IDS` (config.ts) and an entry here.
 */
export const MODULES: readonly ModuleSpec[] = [
  {
    id: "core",
    title: "Core",
    description:
      "ApiClient, response cache (CACHE_STORAGE + cache interceptor), BASE_API_URL, environments",
    interceptor: {
      name: "cacheInterceptor",
      file: "cacheInterceptor",
      order: 100,
    },
    targets: ({ raw, target, files, environmentsDir, config }) => [
      raw(
        path.join(environmentsDir, "environment.ts"),
        buildEnvironmentTsContent(false, config.baseApiUrl),
      ),
      raw(
        path.join(environmentsDir, "environment.prod.ts"),
        buildEnvironmentTsContent(true, config.baseApiUrl),
      ),
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
    notes: [
      "Use ApiClient in feature services: `ngx-base-cli generate service user`.",
      "Cache a GET with `api.get(url, { cache: true })` or `{ context: withCache() }`.",
    ],
  },
  {
    id: "auth",
    title: "Auth",
    description:
      "AuthTokenStore (signal), Bearer interceptor with URL allowlist, 401 → login, authGuard",
    interceptor: {
      name: "authInterceptor",
      file: "authInterceptor",
      order: 10,
    },
    targets: ({ target, files, core }) => [
      target(files.authTokens, "auth.tokens.ts.tpl"),
      target(files.authStore, "auth-token.store.ts.tpl"),
      target(core("authInterceptor"), "auth.interceptor.ts.tpl"),
      target(files.authGuard, "auth.guard.ts.tpl"),
    ],
    notes: [
      "After login call `inject(AuthTokenStore).set(token)`; `clear()` on logout.",
      "Override LOGIN_ROUTE (default /login) and AUTH_ALLOWED_URLS in providers if needed.",
      "Protect routes with `canMatch: [authGuard]`.",
    ],
  },
  {
    id: "errors",
    title: "Errors",
    description: "Error interceptor: 403 → FORBIDDEN_ROUTE, 5xx → HttpErrorBus",
    interceptor: {
      name: "errorInterceptor",
      file: "errorInterceptor",
      order: 20,
    },
    targets: ({ target, core }) => [
      target(core("errorInterceptor"), "error.interceptor.ts.tpl"),
    ],
    notes: [
      "Show 5xx toasts from `inject(HttpErrorBus).serverErrors$`.",
      "Override FORBIDDEN_ROUTE (default /forbidden) in providers if needed.",
    ],
  },
  {
    id: "logging",
    title: "Logging",
    description: "Dev-only request logging interceptor (method, URL, timing)",
    interceptor: {
      name: "loggingInterceptor",
      file: "loggingInterceptor",
      order: 30,
    },
    targets: ({ target, core }) => [
      target(core("loggingInterceptor"), "logging.interceptor.ts.tpl"),
    ],
    notes: ["Logs only when isDevMode() is true."],
  },
  {
    id: "layout",
    title: "Layout",
    description:
      "Public/private layouts, landing page, PUBLIC/PRIVATE routes merged into app.routes.ts",
    targets: (ctx) => {
      const { target, raw, component, importFor, files, appDir, installed } =
        ctx;
      const { privateLayout, publicLayout, landingPage } = ctx.structure;
      const privateRoutes = privateRoutesFile(appDir);
      const publicRoutes = path.join(appDir, "routes/public.routes.ts");
      const guard = installed.has("auth");
      return [
        ...component(
          privateLayout,
          "layout-private.component.ts.tpl",
          "layout-private.component.html.tpl",
        ),
        ...component(
          publicLayout,
          "layout-public.component.ts.tpl",
          "layout-public.component.html.tpl",
        ),
        ...component(
          landingPage,
          "pages-landing-page.component.ts.tpl",
          "pages-landing-page.component.html.tpl",
        ),
        target(privateRoutes, "routes-private.routes.ts.tpl", {
          GUARD: String(guard),
          NO_GUARD: String(!guard),
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
        raw(path.join(appDir, "app.html"), "<router-outlet />\n", true),
      ];
    },
    notes: [
      "Public area at `/` (landing page), private area at `/app`.",
      "Add pages as children of PUBLIC_ROUTES / PRIVATE_ROUTES in routes/.",
    ],
  },
];

export function getModule(id: InstallId): ModuleSpec {
  const spec = MODULES.find((m) => m.id === id);
  if (!spec) throw new Error(`Unknown module "${id}".`);
  return spec;
}

/** Sorts ids into MODULES order (core first), dropping duplicates. */
export function sortIds<T extends InstallId>(ids: readonly T[]): T[] {
  return MODULES.map((m) => m.id).filter((id): id is T =>
    ids.includes(id as T),
  );
}

/** Configured modules, in canonical order (helper for config writes). */
export function withModules(
  config: NgBaseConfig,
  add: readonly ModuleId[],
): NgBaseConfig {
  const modules = MODULE_IDS.filter(
    (id) => config.modules.includes(id) || add.includes(id),
  );
  return { ...config, modules };
}

/**
 * Interceptors of the installed modules, in `withInterceptors([...])` order.
 * The cache interceptor (core) is always present and goes last.
 */
export function interceptorBindings(
  config: NgBaseConfig,
  ids: readonly InstallId[] = installedIds(config),
): InterceptorBinding[] {
  const f = coreFiles(config.naming);
  return MODULES.filter((m) => m.interceptor && ids.includes(m.id))
    .map((m) => m.interceptor as NonNullable<ModuleSpec["interceptor"]>)
    .sort((a, b) => a.order - b.order)
    .map((i) => ({ name: i.name, file: f[i.file] }));
}

/** Canonical position of every interceptor name (for ordered insertion). */
export function interceptorOrder(): Map<string, number> {
  return new Map(
    MODULES.flatMap((m) =>
      m.interceptor ? [[m.interceptor.name, m.interceptor.order] as const] : [],
    ),
  );
}

/** Path (relative to outputDir) of the file that exports BASE_API_URL. */
export function apiTokensFile(config: NgBaseConfig): string {
  return coreFiles(config.naming).apiTokens;
}

function createPlanContext(
  cwd: string,
  config: NgBaseConfig,
  ws: Workspace,
  installed: ReadonlySet<InstallId>,
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

  const aliases = Object.entries(pathAliases(config, ws, [...installed])).map(
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
    installed,
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

/**
 * Files the given modules write, in output order. Modules already in the
 * config count as installed (e.g. `layout` adds the guard when `auth` is there).
 */
export function buildModuleTargets(
  cwd: string,
  config: NgBaseConfig,
  ws: Workspace = DEFAULT_WORKSPACE,
  ids: readonly InstallId[] = installedIds(config),
): GenerationTarget[] {
  const installed = new Set<InstallId>([...installedIds(config), ...ids]);
  const ctx = createPlanContext(cwd, config, ws, installed);
  return sortIds(ids).flatMap((id) => getModule(id).targets(ctx));
}
