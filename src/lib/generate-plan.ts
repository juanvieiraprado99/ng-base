import path from "node:path";
import type { NgxBaseCliConfig, StorageEngine } from "./config.js";

export interface GenerationTarget {
  outPath: string;
  template: string;
  vars: Record<string, string>;
  /** Conteúdo gerado sem template (ex.: barrel). */
  rawContent?: string;
  /** Quando true, outPath é uma pasta a criar (sem ficheiro/placeholder). */
  dirOnly?: boolean;
}

function cacheTemplateForEngine(engine: StorageEngine): string {
  switch (engine) {
    case "sessionStorage":
      return "cache.service.sessionstorage.ts.tpl";
    case "memory":
      return "cache.service.memory.ts.tpl";
    default:
      return "cache.service.localstorage.ts.tpl";
  }
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

function buildBarrelContent(): string {
  const lines = [
    "export * from './cache.service';",
    "export * from './base.service';",
  ];
  return `${lines.join("\n")}\n`;
}

function buildAppRoutesContent(): string {
  const lines = [
    "import { Routes } from '@angular/router';",
    "import { PRIVATE_ROUTES } from './routes/private.routes';",
    "import { PUBLIC_ROUTES } from './routes/public.routes';",
    "",
    "export const routes: Routes = [",
    "  ...PUBLIC_ROUTES,",
    "  ...PRIVATE_ROUTES,",
    "];",
  ];
  return `${lines.join("\n")}\n`;
}

export function buildGenerationTargets(
  cwd: string,
  config: NgxBaseCliConfig,
): GenerationTarget[] {
  const outputDir = config.outputDir;
  const interfacesDir = path.join(cwd, outputDir, "interfaces");
  const servicesDir = path.join(cwd, outputDir, "services");
  const interceptorsDir = path.join(cwd, outputDir, "interceptors");
  const environmentsDir = path.join(cwd, "src/environments");

  const envTargets: GenerationTarget[] = [
    {
      outPath: path.join(environmentsDir, "environment.ts"),
      template: "",
      vars: {},
      rawContent: buildEnvironmentTsContent(false, config.baseApiUrl),
    },
    {
      outPath: path.join(environmentsDir, "environment.prod.ts"),
      template: "",
      vars: {},
      rawContent: buildEnvironmentTsContent(true, config.baseApiUrl),
    },
  ];

  const importCacheInterface =
    config.importStyle === "alias"
      ? "@core/interfaces/cache.interface"
      : "../interfaces/cache.interface";

  const vars: Record<string, string> = {
    IMPORT_CACHE_INTERFACE: importCacheInterface,
    AUTH_TOKEN_NAME: config.authTokenName,
    AUTH_TOKEN_IMPORT: config.authTokenImportPath,
  };

  const baseTemplate = config.useHttpResource
    ? "base.service.httpresource.ts.tpl"
    : "base.service.ts.tpl";

  const targets: GenerationTarget[] = [...envTargets];

  targets.push(
    {
      outPath: path.join(interfacesDir, "cache.interface.ts"),
      template: "cache.interface.ts.tpl",
      vars: {},
    },
    {
      outPath: path.join(servicesDir, "cache.service.ts"),
      template: cacheTemplateForEngine(config.storageEngine),
      vars,
    },
    {
      outPath: path.join(servicesDir, "base.service.ts"),
      template: baseTemplate,
      vars,
    },
  );

  if (config.generateBarrel) {
    targets.push({
      outPath: path.join(servicesDir, "index.ts"),
      template: "",
      vars: {},
      rawContent: buildBarrelContent(),
    });
  }

  if (config.generateAuthInterceptor) {
    targets.push({
      outPath: path.join(interceptorsDir, "auth.interceptor.ts"),
      template: "auth.interceptor.ts.tpl",
      vars,
    });
  }

  if (config.generateErrorInterceptor) {
    targets.push({
      outPath: path.join(interceptorsDir, "error.interceptor.ts"),
      template: "error.interceptor.ts.tpl",
      vars: {},
    });
  }

  if (config.generateLoggingInterceptor) {
    targets.push({
      outPath: path.join(interceptorsDir, "logging.interceptor.ts"),
      template: "logging.interceptor.ts.tpl",
      vars: {},
    });
  }

  if (config.generateProjectStructure) {
    const coreDir = path.join(cwd, outputDir);
    const appDir = path.join(cwd, "src/app");

    const coreEmptyDirs = ["directives", "enum", "guards", "pipes", "utils"];
    if (
      !config.generateAuthInterceptor &&
      !config.generateErrorInterceptor &&
      !config.generateLoggingInterceptor
    ) {
      coreEmptyDirs.push("interceptors");
    }
    for (const dir of coreEmptyDirs) {
      targets.push({
        outPath: path.join(coreDir, dir),
        template: "",
        vars: {},
        dirOnly: true,
      });
    }

    targets.push(
      {
        outPath: path.join(appDir, "layout/private/private.component.ts"),
        template: "layout-private.component.ts.tpl",
        vars: {},
      },
      {
        outPath: path.join(appDir, "layout/private/private.component.html"),
        template: "layout-private.component.html.tpl",
        vars: {},
      },
      {
        outPath: path.join(appDir, "layout/private/components"),
        template: "",
        vars: {},
        dirOnly: true,
      },
      {
        outPath: path.join(appDir, "layout/public/public.component.ts"),
        template: "layout-public.component.ts.tpl",
        vars: {},
      },
      {
        outPath: path.join(appDir, "layout/public/public.component.html"),
        template: "layout-public.component.html.tpl",
        vars: {},
      },
      {
        outPath: path.join(appDir, "layout/public/components"),
        template: "",
        vars: {},
        dirOnly: true,
      },
    );

    targets.push(
      {
        outPath: path.join(
          appDir,
          "pages/landing-page/landing-page.component.ts",
        ),
        template: "pages-landing-page.component.ts.tpl",
        vars: {},
      },
      {
        outPath: path.join(
          appDir,
          "pages/landing-page/landing-page.component.html",
        ),
        template: "pages-landing-page.component.html.tpl",
        vars: {},
      },
      {
        outPath: path.join(appDir, "pages/landing-page/components"),
        template: "",
        vars: {},
        dirOnly: true,
      },
      {
        outPath: path.join(appDir, "pages/landing-page/interfaces"),
        template: "",
        vars: {},
        dirOnly: true,
      },
      {
        outPath: path.join(appDir, "pages/landing-page/services"),
        template: "",
        vars: {},
        dirOnly: true,
      },
    );

    targets.push(
      {
        outPath: path.join(appDir, "routes/private.routes.ts"),
        template: "routes-private.routes.ts.tpl",
        vars: {},
      },
      {
        outPath: path.join(appDir, "routes/public.routes.ts"),
        template: "routes-public.routes.ts.tpl",
        vars: {},
      },
    );

    targets.push(
      {
        outPath: path.join(appDir, "app.routes.ts"),
        template: "",
        vars: {},
        rawContent: buildAppRoutesContent(),
      },
      {
        outPath: path.join(appDir, "shared"),
        template: "",
        vars: {},
        dirOnly: true,
      },
      {
        outPath: path.join(appDir, "app.html"),
        template: "",
        vars: {},
        rawContent: "<router-outlet />\n",
      },
    );
  }

  return targets;
}
