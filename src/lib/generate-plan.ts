import path from "node:path";
import { changeDetectionVars, serviceDecoratorVars } from "./artifact-plan.js";
import type { NgxBaseCliConfig, StorageEngine } from "./config.js";
import { envFileReplacement } from "./patch-angular-json.js";

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

export function buildGenerationTargets(
  cwd: string,
  config: NgxBaseCliConfig,
): GenerationTarget[] {
  const capabilityOptions = {
    serviceDecorator: config.angularTarget >= 22,
    onPushIsDefault: config.angularTarget >= 22,
  };
  const outputDir = config.outputDir;
  const interfacesDir = path.join(cwd, outputDir, "interfaces");
  const servicesDir = path.join(cwd, outputDir, "services");
  const interceptorsDir = path.join(cwd, outputDir, "interceptors");
  const environmentsDir = path.join(cwd, "src/environments");

  // With the modern (`development`) style, `environment.ts` *is* the production
  // build and is replaced by `environment.development.ts` during development.
  // The legacy (`prod`) style is the other way round.
  const replacement = envFileReplacement(config.environmentStyle);
  const isDevStyle = config.environmentStyle === "development";

  const envVars = (production: boolean): Record<string, string> => ({
    PRODUCTION: String(production),
    BASE_API_URL: JSON.stringify(config.baseApiUrl),
  });

  const envTargets: GenerationTarget[] = [
    {
      outPath: path.join(environmentsDir, "environment.ts"),
      template: "environment.ts.tpl",
      vars: envVars(isDevStyle),
    },
    {
      outPath: path.join(cwd, replacement.with),
      template: "environment.ts.tpl",
      vars: envVars(!isDevStyle),
    },
  ];

  const importCacheInterface =
    config.importStyle === "alias"
      ? "@core/interfaces/cache.interface"
      : "../interfaces/cache.interface";

  const importPrefix = config.importStyle === "alias" ? "@core/" : "../";
  const importCacheService = `${importPrefix}services/cache.service`;
  const importBaseService = `${importPrefix}services/base.service`;

  const vars: Record<string, string> = {
    IMPORT_CACHE_INTERFACE: importCacheInterface,
    AUTH_TOKEN_NAME: config.authTokenName,
    AUTH_TOKEN_IMPORT: config.authTokenImportPath,
    BASE_API_URL_IMPORT: importCacheService,
    CACHE_SERVICE_IMPORT: importCacheService,
    BASE_SERVICE_IMPORT: importBaseService,
    ...serviceDecoratorVars(capabilityOptions),
    ...changeDetectionVars(capabilityOptions),
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
      template: "barrel.index.ts.tpl",
      vars: {},
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

  if (config.generateCacheInterceptor) {
    targets.push({
      outPath: path.join(interceptorsDir, "cache.interceptor.ts"),
      template: "cache.interceptor.ts.tpl",
      vars,
    });
  }

  if (config.generateProjectStructure) {
    const coreDir = path.join(cwd, outputDir);
    const appDir = path.join(cwd, "src/app");

    const coreEmptyDirs = ["directives", "enum", "guards", "pipes", "utils"];
    if (
      !config.generateAuthInterceptor &&
      !config.generateErrorInterceptor &&
      !config.generateLoggingInterceptor &&
      !config.generateCacheInterceptor
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
        vars: changeDetectionVars(capabilityOptions),
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
        vars: changeDetectionVars(capabilityOptions),
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
        vars: changeDetectionVars(capabilityOptions),
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
        template: "app.routes.ts.tpl",
        vars: {},
      },
      {
        outPath: path.join(appDir, "shared"),
        template: "",
        vars: {},
        dirOnly: true,
      },
      {
        outPath: path.join(appDir, "app.html"),
        template: "app.html.tpl",
        vars: {},
      },
    );
  }

  return targets;
}
