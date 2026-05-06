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
import {
  PRESET_DESCRIPTIONS,
  PRESETS,
  type PresetName,
} from "../lib/presets.js";
import { renderGenerationTarget } from "../lib/render-target.js";

export async function runInit(
  cwd: string = process.cwd(),
  yes = false
): Promise<void> {
  p.intro(pc.inverse(" ngx-base-cli init "));

  const pkgPath = path.join(cwd, "package.json");
  if (!(await fse.pathExists(pkgPath))) {
    p.outro(
      pc.red("package.json not found. Run this command from the project root.")
    );
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

  let config: NgxBaseCliConfig | null = null;

  if (yes) {
    const presetName = await p.select<PresetName>({
      message: "Which preset would you like to use?",
      options: (
        Object.keys(PRESETS) as PresetName[]
      ).map((key) => ({
        value: key,
        label: key,
        hint: PRESET_DESCRIPTIONS[key],
      })),
      initialValue: "standard" as PresetName,
    });
    if (p.isCancel(presetName)) {
      p.cancel("Cancelled.");
      return;
    }
    config = { ...PRESETS[presetName] };
    p.log.success(
      pc.green(`Using preset "${presetName}": ${PRESET_DESCRIPTIONS[presetName]}`)
    );
  } else {
    config = await runInteractivePrompts(cwd, deps, httpResourceSupported, angularVersion);
  }

  if (!config) return;

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

  if (config.importStyle === "alias") {
    await offerTsconfigPatch(cwd, config);
  }

  const noteBody = buildProviderNote(config, cwd);
  const nextStepLines = [
    "Configure providers in your application (adjust imports if needed):",
    "",
    pc.cyan(noteBody),
  ];
  if (config.useHttpResource) {
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

async function runInteractivePrompts(
  cwd: string,
  deps: Record<string, string>,
  httpResourceSupported: boolean,
  angularVersion: string | null
): Promise<NgxBaseCliConfig | null> {
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
    return null;
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
    return null;
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
    return null;
  }

  let useHttpResource = false;
  if (httpResourceSupported) {
    p.log.info(
      pc.cyan(
        `Angular ${angularVersion}: httpResource is available for GET (Angular 19.1+).`
      )
    );
    const useHttpResourceAnswer = await p.confirm({
      message: "Use httpResource for the GET method? (experimental API)",
      initialValue: true,
    });
    if (p.isCancel(useHttpResourceAnswer)) {
      p.cancel("Cancelled.");
      return null;
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
    return null;
  }

  const generateAuthInterceptor = await p.confirm({
    message: "Generate AuthInterceptor (Bearer token)?",
    initialValue: false,
  });
  if (p.isCancel(generateAuthInterceptor)) {
    p.cancel("Cancelled.");
    return null;
  }

  let authTokenName = "AUTH_TOKEN";
  let authTokenImportPath = "@core/tokens";
  if (generateAuthInterceptor) {
    const tokenName = await p.text({
      message: "Exported InjectionToken<string> name (e.g. AUTH_TOKEN)",
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
      return null;
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
      return null;
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
    return null;
  }

  const generateLoggingInterceptor = await p.confirm({
    message: "Generate LoggingInterceptor (logs requests in devMode only)?",
    initialValue: false,
  });
  if (p.isCancel(generateLoggingInterceptor)) {
    p.cancel("Cancelled.");
    return null;
  }

  const generateBarrel = await p.confirm({
    message: "Generate barrel export (services/index.ts)?",
    initialValue: true,
  });
  if (p.isCancel(generateBarrel)) {
    p.cancel("Cancelled.");
    return null;
  }

  const generateProjectStructure = await p.confirm({
    message:
      "Generate base folder structure (layout, pages, routes, shared, and core subfolders)?",
    initialValue: false,
  });
  if (p.isCancel(generateProjectStructure)) {
    p.cancel("Cancelled.");
    return null;
  }

  return {
    outputDir: String(outputDir).trim().replace(/[/\\]+$/, ""),
    baseApiUrl: String(apiUrl).trim(),
    importStyle,
    useHttpResource,
    storageEngine,
    generateAuthInterceptor,
    authTokenName,
    authTokenImportPath,
    generateErrorInterceptor,
    generateLoggingInterceptor,
    generateBarrel,
    generateProjectStructure,
  };
}

async function offerTsconfigPatch(
  cwd: string,
  config: NgxBaseCliConfig
): Promise<void> {
  const tsconfigPath = path.join(cwd, "tsconfig.json");
  if (!(await fse.pathExists(tsconfigPath))) return;

  const patchAlias = await p.confirm({
    message:
      "Add path aliases (@core/*, @layout/*, @pages/*, @shared/*) to tsconfig.json?",
    initialValue: true,
  });
  if (p.isCancel(patchAlias) || !patchAlias) return;

  const raw = await fse.readFile(tsconfigPath, "utf8");
  let tsconfig: {
    compilerOptions?: { paths?: Record<string, string[]>; baseUrl?: string };
  };
  try {
    tsconfig = JSON.parse(raw) as typeof tsconfig;
  } catch {
    p.log.warn(pc.yellow("Could not parse tsconfig.json — skipping patch."));
    return;
  }

  if (!tsconfig.compilerOptions) tsconfig.compilerOptions = {};
  if (!tsconfig.compilerOptions.paths) tsconfig.compilerOptions.paths = {};
  if (!tsconfig.compilerOptions.baseUrl) {
    tsconfig.compilerOptions.baseUrl = "./";
  }

  const outDirSrc = config.outputDir; // e.g. src/app/core
  const appDir = "src/app";

  const newAliases: Record<string, string[]> = {
    "@core/*": [`${outDirSrc}/*`],
    "@layout/*": [`${appDir}/layout/*`],
    "@pages/*": [`${appDir}/pages/*`],
    "@shared/*": [`${appDir}/shared/*`],
  };

  let added = 0;
  for (const [alias, targets] of Object.entries(newAliases)) {
    if (!tsconfig.compilerOptions.paths[alias]) {
      tsconfig.compilerOptions.paths[alias] = targets;
      added++;
    }
  }

  if (added === 0) {
    p.log.info("All aliases already present in tsconfig.json — nothing to do.");
    return;
  }

  const newContent = JSON.stringify(tsconfig, null, 2) + "\n";

  p.log.info(pc.dim("Diff preview:"));
  const addedAliases = Object.keys(newAliases).filter(
    (a) => !JSON.parse(raw).compilerOptions?.paths?.[a]
  );
  for (const a of addedAliases) {
    p.log.info(pc.green(`  + "${a}": ${JSON.stringify(newAliases[a])}`));
  }

  await fse.outputFile(tsconfigPath, newContent, "utf8");
  p.log.success(
    pc.green(`tsconfig.json updated (${added} alias${added > 1 ? "es" : ""} added).`)
  );
}

function buildProviderNote(config: NgxBaseCliConfig, cwd: string): string {
  const lines: string[] = [];
  const needInterceptors =
    config.generateAuthInterceptor ||
    config.generateErrorInterceptor ||
    config.generateLoggingInterceptor;

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
  if (config.generateLoggingInterceptor) {
    const ip = importFromSrcApp(
      cwd,
      path.join(cwd, config.outputDir, "interceptors/logging.interceptor.ts")
    );
    lines.push(`import { loggingInterceptor } from '${ip}';`);
  }

  lines.push("");
  lines.push("// providers: [");

  const interceptorNames: string[] = [];
  if (config.generateAuthInterceptor) interceptorNames.push("authInterceptor");
  if (config.generateErrorInterceptor)
    interceptorNames.push("errorInterceptor");
  if (config.generateLoggingInterceptor)
    interceptorNames.push("loggingInterceptor");

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
