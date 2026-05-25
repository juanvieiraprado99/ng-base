import path from "node:path";
import * as p from "@clack/prompts";
import fse from "fs-extra";
import pc from "picocolors";
import {
  parseAngularCoreVersion,
  versionSupportsHttpResource,
} from "../lib/angular-version.js";
import type { NgxBaseCliConfig, StorageEngine } from "../lib/config.js";
import { DEFAULT_NGX_BASE_CONFIG, writeNgxBaseConfig } from "../lib/config.js";
import { buildGenerationTargets } from "../lib/generate-plan.js";
import { importFromSrcApp } from "../lib/import-paths.js";
import {
  type Manifest,
  manifestKey,
  sha256,
  writeManifest,
} from "../lib/manifest.js";
import { detectPackageManager, dlxCommand } from "../lib/package-manager.js";
import { parseJsonWithComments } from "../lib/parse-jsonc.js";
import { patchAngularJsonFileReplacements } from "../lib/patch-angular-json.js";
import { patchAppConfigForHttp } from "../lib/patch-app-config.js";
import {
  PRESET_DESCRIPTIONS,
  PRESETS,
  type PresetName,
} from "../lib/presets.js";
import { renderGenerationTarget } from "../lib/render-target.js";
import {
  validateIdentifier,
  validateImportPath,
  validateRelativePath,
  validateUrl,
} from "../lib/validators.js";

async function promptPresetSelection(): Promise<NgxBaseCliConfig | null> {
  const presetName = await p.select<PresetName>({
    message: "Which preset would you like to use?",
    options: (Object.keys(PRESETS) as PresetName[]).map((key) => ({
      value: key,
      label: key,
      hint: PRESET_DESCRIPTIONS[key],
    })),
    initialValue: "minimal" as PresetName,
  });
  if (p.isCancel(presetName)) {
    p.cancel("Cancelled.");
    return null;
  }
  p.log.success(
    pc.green(
      `Using preset "${presetName}": ${PRESET_DESCRIPTIONS[presetName]}`,
    ),
  );
  return { ...PRESETS[presetName] };
}

export async function runInit(
  cwd: string = process.cwd(),
  yes = false,
  dryRun = false,
): Promise<void> {
  p.intro(pc.inverse(" ngx-base-cli init "));

  const pkgPath = path.join(cwd, "package.json");
  if (!(await fse.pathExists(pkgPath))) {
    p.outro(
      pc.red("package.json not found. Run this command from the project root."),
    );
    process.exitCode = 1;
    return;
  }

  const pkgRaw = await fse.readFile(pkgPath, "utf8");
  let pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  try {
    pkg = JSON.parse(pkgRaw);
  } catch {
    p.outro(pc.red("package.json is not valid JSON. Fix it and re-run."));
    process.exitCode = 1;
    return;
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (!deps["@angular/core"]) {
    const ok = await p.confirm({
      message: "@angular/core is not listed in dependencies. Continue anyway?",
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
    config = await promptPresetSelection();
  } else {
    const setupMode = await p.select<"preset" | "customize" | "custom">({
      message: "How would you like to set up ngx-base?",
      options: [
        {
          value: "preset",
          label: "Quick — choose a preset",
          hint: "Recommended (same as ngx-base-cli init --yes)",
        },
        {
          value: "customize",
          label: "Customize a preset",
          hint: "Start from a preset, then tweak",
        },
        {
          value: "custom",
          label: "Custom — step-by-step wizard",
          hint: "Fine-grained options",
        },
      ],
      initialValue: "preset",
    });
    if (p.isCancel(setupMode)) {
      p.cancel("Cancelled.");
      return;
    }
    if (setupMode === "preset") {
      config = await promptPresetSelection();
    } else if (setupMode === "customize") {
      const base = await promptPresetSelection();
      config = base
        ? await runInteractivePrompts(
            deps,
            httpResourceSupported,
            angularVersion,
            base,
          )
        : null;
    } else {
      config = await runInteractivePrompts(
        deps,
        httpResourceSupported,
        angularVersion,
      );
    }
  }

  if (!config) return;

  if (!yes && !dryRun) {
    p.note(buildConfigSummary(config), "Configuration");
    const proceed = await p.confirm({
      message: "Generate files with this configuration?",
      initialValue: true,
    });
    if (p.isCancel(proceed) || !proceed) {
      p.cancel("Cancelled.");
      return;
    }
  }

  const targets = buildGenerationTargets(cwd, config);

  if (dryRun) {
    const lines: string[] = [];
    for (const t of targets) {
      const exists = await fse.pathExists(t.outPath);
      const tag = t.dirOnly
        ? pc.green("mkdir")
        : exists
          ? pc.yellow("overwrite")
          : pc.green("create");
      lines.push(
        `${tag}  ${path.relative(cwd, t.outPath).replace(/\\/g, "/")}`,
      );
    }
    p.note(lines.join("\n"), "Files");

    const patches: string[] = [];
    if (await fse.pathExists(path.join(cwd, "angular.json"))) {
      patches.push("angular.json — production fileReplacements");
    }
    if (
      config.importStyle === "alias" &&
      (await fse.pathExists(path.join(cwd, "tsconfig.json")))
    ) {
      patches.push(
        "tsconfig.json — path aliases (@core/*, @layout/*, @pages/*, @shared/*)",
      );
    }
    if (await fse.pathExists(path.join(cwd, "src/app/app.config.ts"))) {
      patches.push("src/app/app.config.ts — providers (HTTP + BASE_API_URL)");
    }
    if (patches.length > 0) {
      p.note(
        patches.map((item) => `${pc.cyan("patch")}  ${item}`).join("\n"),
        "Patches",
      );
    }
    p.outro(pc.green(`Dry run complete — ${targets.length} file(s) planned.`));
    return;
  }

  const existingChecks = await Promise.all(
    targets.map((t) =>
      t.dirOnly ? Promise.resolve(false) : fse.pathExists(t.outPath),
    ),
  );
  const anyExisting = existingChecks.some(Boolean);

  let overwriteAll = false;
  if (anyExisting) {
    const overwriteAnswer = await p.confirm({
      message: "Some files already exist. Overwrite all existing files?",
      initialValue: false,
    });
    if (p.isCancel(overwriteAnswer)) {
      p.cancel("Cancelled.");
      return;
    }
    overwriteAll = overwriteAnswer;
  }

  let skippedExistingCount = 0;
  const manifest: Manifest = { version: 1, files: {} };
  for (const t of targets) {
    if (t.dirOnly) {
      await fse.ensureDir(t.outPath);
      p.log.success(pc.green(`OK: ${path.relative(cwd, t.outPath)}`));
      continue;
    }

    await fse.mkdir(path.dirname(t.outPath), { recursive: true });

    if (await fse.pathExists(t.outPath)) {
      if (!overwriteAll) {
        skippedExistingCount++;
        continue;
      }
    }

    const content = await renderGenerationTarget(t);
    await fse.outputFile(t.outPath, content, "utf8");
    manifest.files[manifestKey(cwd, t.outPath)] = {
      hash: sha256(content),
      template: t.template,
    };
    p.log.success(pc.green(`OK: ${path.relative(cwd, t.outPath)}`));
  }
  if (skippedExistingCount > 0) {
    p.log.info(
      pc.dim(
        `Skipped ${skippedExistingCount} existing file(s) (overwrite declined).`,
      ),
    );
  }

  await writeNgxBaseConfig(cwd, config);
  await writeManifest(cwd, manifest);

  const angularJsonPath = path.join(cwd, "angular.json");
  if (await fse.pathExists(angularJsonPath)) {
    const angularResult = await patchAngularJsonFileReplacements(cwd);
    if (!angularResult.ok) {
      p.log.warn(
        pc.yellow(
          "Could not update angular.json (parse error or no application build target). Add fileReplacements for environments manually.",
        ),
      );
    } else if (angularResult.mutated) {
      p.log.success(
        pc.green(
          `OK: ${path.relative(cwd, angularJsonPath)} (production fileReplacements)`,
        ),
      );
    }
  }

  if (config.importStyle === "alias") {
    await offerTsconfigPatch(cwd, config);
  }

  const appCfgResult = await patchAppConfigForHttp(cwd, config);
  let noteBody: string;
  if (appCfgResult.patched) {
    noteBody =
      "Updated src/app/app.config.ts with environment.baseApiUrl" +
      (config.generateAuthInterceptor ||
      config.generateErrorInterceptor ||
      config.generateLoggingInterceptor
        ? ", provideHttpClient(withInterceptors(...))"
        : "") +
      ", and BASE_API_URL.";
    if (
      config.generateProjectStructure &&
      (await fse.pathExists(path.join(cwd, "src/app/app.html")))
    ) {
      noteBody +=
        " Ensure RootComponent/template imports RouterOutlet if app.html uses <router-outlet />.";
    }
  } else {
    noteBody = buildProviderNote(config, cwd);
    if (!appCfgResult.appConfigExists) {
      noteBody =
        `No src/app/app.config.ts found — add bootstrap config manually:\n\n` +
        noteBody;
    }
  }

  const nextStepLines = appCfgResult.patched
    ? ["Next:", "", pc.cyan(noteBody)]
    : [
        "Configure providers in your application (adjust imports if needed):",
        "",
        pc.cyan(noteBody),
      ];
  if (config.useHttpResource) {
    nextStepLines.push(
      "",
      pc.yellow(
        "httpResource é experimental: https://angular.dev/guide/signals/resource",
      ),
    );
  }

  p.note(nextStepLines.join("\n"), "Next step");

  const dlx = dlxCommand(await detectPackageManager(cwd));
  p.note(
    [
      `${pc.cyan(`${dlx} ngx-base-cli add user`)}      ${pc.dim("# scaffold a service")}`,
      `${pc.cyan(`${dlx} ngx-base-cli doctor`)}        ${pc.dim("# verify setup")}`,
      `${pc.cyan(`${dlx} ngx-base-cli list`)}          ${pc.dim("# show sync status")}`,
    ].join("\n"),
    "Commands",
  );

  p.outro(pc.green("ngx-base-cli init finished."));
}

async function runInteractivePrompts(
  deps: Record<string, string>,
  httpResourceSupported: boolean,
  angularVersion: string | null,
  defaults: NgxBaseCliConfig = DEFAULT_NGX_BASE_CONFIG,
): Promise<NgxBaseCliConfig | null> {
  if (httpResourceSupported) {
    p.log.info(
      pc.cyan(
        `Angular ${angularVersion}: httpResource is available for GET (Angular 19.1+).`,
      ),
    );
  } else if (deps["@angular/core"]) {
    p.log.info(
      pc.dim(
        angularVersion
          ? `Angular ${angularVersion}: httpResource option is hidden (requires Angular 19.1 or newer).`
          : "Could not determine Angular version; httpResource is not available in this wizard.",
      ),
    );
  }

  const initialInterceptors: ("auth" | "error" | "logging")[] = [];
  if (defaults.generateAuthInterceptor) initialInterceptors.push("auth");
  if (defaults.generateErrorInterceptor) initialInterceptors.push("error");
  if (defaults.generateLoggingInterceptor) initialInterceptors.push("logging");

  const answers = await p.group(
    {
      apiUrl: () =>
        p.text({
          message: "BASE_API_URL value (for the provider)",
          initialValue: defaults.baseApiUrl,
          placeholder: "https://...",
          validate: (value) => validateUrl(String(value)),
        }),
      outputDir: () =>
        p.text({
          message:
            "Output directory (models and services relative to project root)",
          initialValue: defaults.outputDir,
          placeholder: "src/app/core",
          validate: (value) => validateRelativePath(String(value)),
        }),
      importStyle: () =>
        p.select<"alias" | "relative">({
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
          initialValue: defaults.importStyle,
        }),
      useHttpResource: () =>
        httpResourceSupported
          ? p.confirm({
              message:
                "Use httpResource for the GET method? (experimental API)",
              initialValue: defaults.useHttpResource,
            })
          : undefined,
      storageEngine: () =>
        p.select<StorageEngine>({
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
          initialValue: defaults.storageEngine,
        }),
      interceptors: () =>
        p.multiselect<"auth" | "error" | "logging">({
          message:
            "HTTP interceptors to generate (space to toggle, enter when done)",
          options: [
            { value: "auth", label: "AuthInterceptor", hint: "Bearer token" },
            {
              value: "error",
              label: "ErrorInterceptor",
              hint: "401→/login, 403→/forbidden, 5xx→Subject",
            },
            {
              value: "logging",
              label: "LoggingInterceptor",
              hint: "Logs requests in devMode only",
            },
          ],
          required: false,
          initialValues: initialInterceptors,
        }),
      authTokenName: ({ results }) =>
        results.interceptors?.includes("auth")
          ? p.text({
              message: "Exported InjectionToken<string> name (e.g. AUTH_TOKEN)",
              initialValue: defaults.authTokenName,
              validate: (v) => validateIdentifier(String(v)),
            })
          : undefined,
      authTokenImportPath: ({ results }) =>
        results.interceptors?.includes("auth")
          ? p.text({
              message: `Import path for the token (module that exports ${
                results.authTokenName ?? defaults.authTokenName
              })`,
              initialValue: defaults.authTokenImportPath,
              placeholder: "@core/tokens",
              validate: (v) => validateImportPath(String(v)),
            })
          : undefined,
      generateBarrel: () =>
        p.confirm({
          message: "Generate barrel export (services/index.ts)?",
          initialValue: defaults.generateBarrel,
        }),
      generateProjectStructure: () =>
        p.confirm({
          message:
            "Generate base folder structure (layout, pages, routes, shared, and core subfolders)?",
          initialValue: defaults.generateProjectStructure,
        }),
    },
    {
      onCancel: () => {
        p.cancel("Cancelled.");
        process.exit(0);
      },
    },
  );

  const interceptors = answers.interceptors ?? [];

  return {
    outputDir: String(answers.outputDir)
      .trim()
      .replace(/[/\\]+$/, ""),
    baseApiUrl: String(answers.apiUrl).trim(),
    importStyle: answers.importStyle,
    useHttpResource: Boolean(answers.useHttpResource),
    storageEngine: answers.storageEngine,
    generateAuthInterceptor: interceptors.includes("auth"),
    authTokenName: answers.authTokenName
      ? String(answers.authTokenName).trim()
      : defaults.authTokenName,
    authTokenImportPath: answers.authTokenImportPath
      ? String(answers.authTokenImportPath).trim()
      : defaults.authTokenImportPath,
    generateErrorInterceptor: interceptors.includes("error"),
    generateLoggingInterceptor: interceptors.includes("logging"),
    generateBarrel: answers.generateBarrel,
    generateProjectStructure: answers.generateProjectStructure,
  };
}

function buildConfigSummary(config: NgxBaseCliConfig): string {
  const interceptors = [
    config.generateAuthInterceptor && "auth",
    config.generateErrorInterceptor && "error",
    config.generateLoggingInterceptor && "logging",
  ].filter(Boolean) as string[];

  const rows: [string, string][] = [
    ["Output dir", config.outputDir],
    ["Base API URL", config.baseApiUrl],
    ["Import style", config.importStyle],
    ["Storage", config.storageEngine],
    ["httpResource", config.useHttpResource ? "yes" : "no"],
    ["Interceptors", interceptors.length ? interceptors.join(", ") : "none"],
    ["Barrel export", config.generateBarrel ? "yes" : "no"],
    ["Project structure", config.generateProjectStructure ? "yes" : "no"],
  ];
  if (config.generateAuthInterceptor) {
    rows.push(["Auth token", config.authTokenName]);
    rows.push(["Token import", config.authTokenImportPath]);
  }

  const labelWidth = Math.max(...rows.map(([label]) => label.length));
  return rows
    .map(([label, value]) => `${label.padEnd(labelWidth)}  ${pc.cyan(value)}`)
    .join("\n");
}

async function offerTsconfigPatch(
  cwd: string,
  config: NgxBaseCliConfig,
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
    tsconfig = parseJsonWithComments(raw) as typeof tsconfig;
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

  const addedAliases: string[] = [];
  for (const [alias, targets] of Object.entries(newAliases)) {
    if (!tsconfig.compilerOptions.paths[alias]) {
      tsconfig.compilerOptions.paths[alias] = targets;
      addedAliases.push(alias);
    }
  }

  if (addedAliases.length === 0) {
    p.log.info("All aliases already present in tsconfig.json — nothing to do.");
    return;
  }

  const newContent = `${JSON.stringify(tsconfig, null, 2)}\n`;

  p.log.info(pc.dim("Diff preview:"));
  for (const a of addedAliases) {
    p.log.info(pc.green(`  + "${a}": ${JSON.stringify(newAliases[a])}`));
  }

  await fse.outputFile(tsconfigPath, newContent, "utf8");
  p.log.success(
    pc.green(
      `tsconfig.json updated (${addedAliases.length} alias${addedAliases.length > 1 ? "es" : ""} added).`,
    ),
  );
}

function buildProviderNote(config: NgxBaseCliConfig, cwd: string): string {
  const lines: string[] = [];
  const needInterceptors =
    config.generateAuthInterceptor ||
    config.generateErrorInterceptor ||
    config.generateLoggingInterceptor;

  lines.push(`import { environment } from '../environments/environment';`);
  lines.push(
    `import { provideHttpClient${needInterceptors ? ", withInterceptors" : ""} } from '@angular/common/http';`,
  );

  const cacheImport = importFromSrcApp(
    cwd,
    path.join(cwd, config.outputDir, "services/cache.service.ts"),
  );
  lines.push(`import { BASE_API_URL } from '${cacheImport}';`);

  if (config.generateAuthInterceptor) {
    const ip = importFromSrcApp(
      cwd,
      path.join(cwd, config.outputDir, "interceptors/auth.interceptor.ts"),
    );
    lines.push(`import { authInterceptor } from '${ip}';`);
  }
  if (config.generateErrorInterceptor) {
    const ip = importFromSrcApp(
      cwd,
      path.join(cwd, config.outputDir, "interceptors/error.interceptor.ts"),
    );
    lines.push(`import { errorInterceptor } from '${ip}';`);
  }
  if (config.generateLoggingInterceptor) {
    const ip = importFromSrcApp(
      cwd,
      path.join(cwd, config.outputDir, "interceptors/logging.interceptor.ts"),
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
      `  provideHttpClient(withInterceptors([${interceptorNames.join(", ")}])),`,
    );
  } else {
    lines.push(`  provideHttpClient(),`);
  }

  lines.push(`  { provide: BASE_API_URL, useValue: environment.baseApiUrl },`);
  lines.push("// ],");

  return lines.join("\n");
}
