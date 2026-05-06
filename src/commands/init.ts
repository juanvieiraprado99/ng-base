import * as p from "@clack/prompts";
import fse from "fs-extra";
import path from "node:path";
import pc from "picocolors";
import {
  parseAngularCoreVersion,
  versionSupportsHttpResource,
} from "../lib/angular-version.js";
import type { NgxBaseCliConfig, StorageEngine } from "../lib/config.js";
import { writeNgxBaseConfig } from "../lib/config.js";
import { buildGenerationTargets } from "../lib/generate-plan.js";
import { importFromSrcApp } from "../lib/import-paths.js";
import { renderGenerationTarget } from "../lib/render-target.js";

export async function runInit(cwd: string = process.cwd()): Promise<void> {
  p.intro(pc.inverse(" ngx-base-cli init "));

  const pkgPath = path.join(cwd, "package.json");
  if (!(await fse.pathExists(pkgPath))) {
    p.outro(pc.red("package.json not found. Run this command from the project root."));
    process.exitCode = 1;
    return;
  }

  const pkgRaw = await fse.readFile(pkgPath, "utf8");
  const pkg = JSON.parse(pkgRaw) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (!deps["@angular/core"]) {
    const ok = await p.confirm({
      message:
        "@angular/core is not listed in dependencies. Continue anyway?",
      initialValue: false,
    });
    if (p.isCancel(ok) || !ok) {
      p.cancel("Cancelled.");
      return;
    }
  }

  const angularVersion = parseAngularCoreVersion(deps["@angular/core"]);
  const httpResourceSupported = versionSupportsHttpResource(angularVersion);

  const apiUrl = await p.text({
    message: "BASE_API_URL value (for the provider)",
    initialValue: "https://api.example.com",
    placeholder: "https://...",
    validate: (value) => {
      const v = String(value).trim();
      if (!/^https?:\/\//i.test(v)) {
        return "The URL must start with http:// or https://";
      }
    },
  });
  if (p.isCancel(apiUrl)) {
    p.cancel("Cancelled.");
    return;
  }

  const outputDir = await p.text({
    message: "Output directory (models and services relative to project root)",
    initialValue: "src/app/core",
    placeholder: "src/app/core",
    validate: (value) => {
      const v = String(value).trim();
      if (!v) return "Enter a path.";
      if (path.isAbsolute(v)) {
        return "Use a path relative to the project root (e.g. src/app/core).";
      }
    },
  });
  if (p.isCancel(outputDir)) {
    p.cancel("Cancelled.");
    return;
  }

  const importStyle = await p.select<"alias" | "relative">({
    message: "Import style for cache.interface",
    options: [
      {
        value: "alias",
        label: "Path alias (@core/interfaces/cache.interface)",
      },
      {
        value: "relative",
        label: "Relative (../interfaces/cache.interface)",
      },
    ],
    initialValue: "alias",
  });
  if (p.isCancel(importStyle)) {
    p.cancel("Cancelled.");
    return;
  }

  let useHttpResource = false;
  if (httpResourceSupported) {
    p.log.info(
      pc.cyan(
        `Angular ${angularVersion}: httpResource is available for GET (Angular 19.1+).`
      )
    );
    const useHttpResourceAnswer = await p.confirm({
      message:
        "Use httpResource for the GET method? (experimental API)",
      initialValue: true,
    });
    if (p.isCancel(useHttpResourceAnswer)) {
      p.cancel("Cancelled.");
      return;
    }
    useHttpResource = Boolean(useHttpResourceAnswer);
  } else if (deps["@angular/core"]) {
    p.log.info(
      pc.dim(
        angularVersion
          ? `Angular ${angularVersion}: httpResource option is hidden (requires Angular 19.1 or newer).`
          : "Could not determine Angular version; httpResource is not available in this wizard."
      )
    );
  }

  const storageEngine = await p.select<StorageEngine>({
    message: "CacheService storage backend",
    options: [
      {
        value: "localStorage",
        label: "localStorage — persists across sessions",
      },
      {
        value: "sessionStorage",
        label: "sessionStorage — per browser tab (volatile)",
      },
      {
        value: "memory",
        label: "memory (Map) — suited for SSR / Node",
      },
    ],
    initialValue: "localStorage",
  });
  if (p.isCancel(storageEngine)) {
    p.cancel("Cancelled.");
    return;
  }

  const generateAuthInterceptor = await p.confirm({
    message: "Generate AuthInterceptor (Bearer token)?",
    initialValue: false,
  });
  if (p.isCancel(generateAuthInterceptor)) {
    p.cancel("Cancelled.");
    return;
  }

  let authTokenName = "AUTH_TOKEN";
  let authTokenImportPath = "@core/tokens";
  if (generateAuthInterceptor) {
    const tokenName = await p.text({
      message:
        "Exported InjectionToken<string> name (e.g. AUTH_TOKEN)",
      initialValue: "AUTH_TOKEN",
      validate: (v) => {
        const s = String(v).trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) {
          return "Must be a valid JavaScript identifier.";
        }
      },
    });
    if (p.isCancel(tokenName)) {
      p.cancel("Cancelled.");
      return;
    }
    authTokenName = String(tokenName).trim();

    const tokenImport = await p.text({
      message:
        "Import path for the token (module that exports " + authTokenName + ")",
      initialValue: "@core/tokens",
      placeholder: "@core/tokens",
    });
    if (p.isCancel(tokenImport)) {
      p.cancel("Cancelled.");
      return;
    }
    authTokenImportPath = String(tokenImport).trim();
  }

  const generateErrorInterceptor = await p.confirm({
    message:
      "Generate ErrorInterceptor (401→/login, 403→/forbidden, 5xx→Subject)?",
    initialValue: false,
  });
  if (p.isCancel(generateErrorInterceptor)) {
    p.cancel("Cancelled.");
    return;
  }

  const generateBarrel = await p.confirm({
    message: "Generate barrel export (services/index.ts)?",
    initialValue: true,
  });
  if (p.isCancel(generateBarrel)) {
    p.cancel("Cancelled.");
    return;
  }

  const generateProjectStructure = await p.confirm({
    message:
      "Generate base folder structure (layout, pages, routes, shared, and core subfolders)?",
    initialValue: false,
  });
  if (p.isCancel(generateProjectStructure)) {
    p.cancel("Cancelled.");
    return;
  }

  const config: NgxBaseCliConfig = {
    outputDir: String(outputDir).trim().replace(/[/\\]+$/, ""),
    baseApiUrl: String(apiUrl).trim(),
    importStyle,
    useHttpResource,
    storageEngine,
    generateAuthInterceptor,
    authTokenName,
    authTokenImportPath,
    generateErrorInterceptor,
    generateBarrel,
    generateProjectStructure,
  };

  const targets = buildGenerationTargets(cwd, config);

  for (const t of targets) {
    await fse.mkdir(path.dirname(t.outPath), { recursive: true });

    if (await fse.pathExists(t.outPath)) {
      const overwrite = await p.confirm({
        message: `${path.relative(cwd, t.outPath)} already exists. Overwrite?`,
        initialValue: false,
      });
      if (p.isCancel(overwrite)) {
        p.cancel("Cancelled.");
        return;
      }
      if (!overwrite) {
        p.log.info(`Skipped: ${path.relative(cwd, t.outPath)}`);
        continue;
      }
    }

    const content = await renderGenerationTarget(t);
    await fse.outputFile(t.outPath, content, "utf8");
    p.log.success(pc.green(`OK: ${path.relative(cwd, t.outPath)}`));
  }

  await writeNgxBaseConfig(cwd, config);

  const noteBody = buildProviderNote(config, cwd);
  const nextStepLines = [
    "Configure providers in your application (adjust imports if needed):",
    "",
    pc.cyan(noteBody),
  ];
  if (useHttpResource) {
    nextStepLines.push(
      "",
      pc.yellow(
        "httpResource é experimental: https://angular.dev/guide/signals/resource"
      )
    );
  }

  p.note(nextStepLines.join("\n"), "Next step");

  p.outro(pc.green("ngx-base-cli init finished."));
}

function buildProviderNote(config: NgxBaseCliConfig, cwd: string): string {
  const lines: string[] = [];
  const needInterceptors =
    config.generateAuthInterceptor || config.generateErrorInterceptor;

  lines.push(
    `import { provideHttpClient${needInterceptors ? ", withInterceptors" : ""} } from '@angular/common/http';`
  );

  const cacheImport = importFromSrcApp(
    cwd,
    path.join(cwd, config.outputDir, "services/cache.service.ts")
  );
  lines.push(`import { BASE_API_URL } from '${cacheImport}';`);

  if (config.generateAuthInterceptor) {
    const ip = importFromSrcApp(
      cwd,
      path.join(cwd, config.outputDir, "interceptors/auth.interceptor.ts")
    );
    lines.push(`import { authInterceptor } from '${ip}';`);
  }
  if (config.generateErrorInterceptor) {
    const ip = importFromSrcApp(
      cwd,
      path.join(cwd, config.outputDir, "interceptors/error.interceptor.ts")
    );
    lines.push(`import { errorInterceptor } from '${ip}';`);
  }

  lines.push("");
  lines.push("// providers: [");

  const interceptorNames: string[] = [];
  if (config.generateAuthInterceptor) interceptorNames.push("authInterceptor");
  if (config.generateErrorInterceptor)
    interceptorNames.push("errorInterceptor");

  if (interceptorNames.length > 0) {
    lines.push(
      `  provideHttpClient(withInterceptors([${interceptorNames.join(", ")}])),`
    );
  } else {
    lines.push(`  provideHttpClient(),`);
  }

  lines.push(
    `  { provide: BASE_API_URL, useValue: '${config.baseApiUrl}' },`
  );
  lines.push("// ],");

  return lines.join("\n");
}
