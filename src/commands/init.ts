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
import {
  apiTokensFile,
  buildGenerationTargets,
  interceptorBindings,
  pathAliases,
} from "../lib/generate-plan.js";
import { importFromSrcApp } from "../lib/import-paths.js";
import {
  type Manifest,
  manifestKey,
  readManifest,
  sha256,
  writeManifest,
} from "../lib/manifest.js";
import {
  detectNamingStyle,
  NAMING_STYLES,
  type NamingStyle,
} from "../lib/naming-style.js";
import { detectPackageManager, dlxCommand } from "../lib/package-manager.js";
import { patchAngularJsonFileReplacements } from "../lib/patch-angular-json.js";
import { patchAppConfigForHttp } from "../lib/patch-app-config.js";
import { patchAppRoutes } from "../lib/patch-app-routes.js";
import {
  applyTsconfigAliases,
  planTsconfigAliases,
} from "../lib/patch-tsconfig.js";
import {
  PRESET_DESCRIPTIONS,
  PRESETS,
  type PresetName,
} from "../lib/presets.js";
import { renderGenerationTarget } from "../lib/render-target.js";
import { validateRelativePath, validateUrl } from "../lib/validators.js";
import { resolveWorkspace, type Workspace } from "../lib/workspace.js";

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

export interface InitOptions {
  /** Non-interactive: no prompts at all (preset defaults to "standard"). */
  yes?: boolean;
  dryRun?: boolean;
  /** Preset to use without asking. */
  preset?: string;
  /** Skip the tsconfig.json path-alias patch (falls back to relative imports). */
  tsconfig?: boolean;
  /** angular.json project to target (default: auto-detect). */
  project?: string;
  /** File naming convention: auto (detect), modern or suffixed. */
  naming?: string;
}

const NAMING_CHOICES = ["auto", ...NAMING_STYLES] as const;

function isPresetName(value: string): value is PresetName {
  return Object.hasOwn(PRESETS, value);
}

export async function runInit(
  cwd: string = process.cwd(),
  opts: InitOptions = {},
): Promise<void> {
  const yes = opts.yes ?? false;
  const dryRun = opts.dryRun ?? false;
  p.intro(pc.inverse(" ngx-base-cli init "));

  if (opts.preset !== undefined && !isPresetName(opts.preset)) {
    p.outro(
      pc.red(
        `Unknown preset "${opts.preset}". Use one of: ${Object.keys(PRESETS).join(", ")}.`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  if (
    opts.naming !== undefined &&
    !(NAMING_CHOICES as readonly string[]).includes(opts.naming)
  ) {
    p.outro(
      pc.red(
        `Unknown naming "${opts.naming}". Use one of: ${NAMING_CHOICES.join(", ")}.`,
      ),
    );
    process.exitCode = 1;
    return;
  }

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
  if (!deps["@angular/core"] && yes) {
    p.log.warn(
      pc.yellow("@angular/core is not listed in dependencies — continuing."),
    );
  } else if (!deps["@angular/core"]) {
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

  let ws: Workspace;
  try {
    ws = await resolveWorkspace(cwd, opts.project);
  } catch (err) {
    p.outro(pc.red(err instanceof Error ? err.message : String(err)));
    process.exitCode = 1;
    return;
  }
  if (ws.projectName) {
    p.log.info(
      pc.dim(
        `Project: ${ws.projectName} (${ws.appDir}, prefix "${ws.prefix}")`,
      ),
    );
  }

  const angularMajor = angularVersion
    ? Number.parseInt(angularVersion, 10)
    : null;
  const detected = await detectNamingStyle(cwd, ws, angularMajor);
  const forcedNaming =
    opts.naming === "modern" || opts.naming === "suffixed"
      ? opts.naming
      : undefined;
  const naming: NamingStyle = forcedNaming ?? detected.style;
  p.log.info(
    pc.dim(
      `Naming: ${naming} (${forcedNaming ? "--naming" : detected.reason})`,
    ),
  );

  /** Apply workspace-derived defaults (outputDir under the app dir, naming, project). */
  const withWorkspace = (c: NgxBaseCliConfig): NgxBaseCliConfig => ({
    ...c,
    outputDir:
      c.outputDir === DEFAULT_NGX_BASE_CONFIG.outputDir
        ? `${ws.appDir}/core`
        : c.outputDir,
    naming,
    // Pin the resolved project so a later angular.json change cannot retarget.
    project: opts.project ?? ws.projectName ?? "",
  });

  let config: NgxBaseCliConfig | null = null;

  if (opts.preset !== undefined && isPresetName(opts.preset)) {
    config = withWorkspace(PRESETS[opts.preset]);
    p.log.success(
      pc.green(
        `Using preset "${opts.preset}": ${PRESET_DESCRIPTIONS[opts.preset]}`,
      ),
    );
  } else if (yes) {
    config = withWorkspace(PRESETS.standard);
    p.log.success(
      pc.green(
        `Using preset "standard": ${PRESET_DESCRIPTIONS.standard} (pass --preset to choose)`,
      ),
    );
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
    const namingHint = forcedNaming ? "--naming" : detected.reason;
    if (setupMode === "preset") {
      const base = await promptPresetSelection();
      config = base ? withWorkspace(base) : null;
    } else if (setupMode === "customize") {
      const base = await promptPresetSelection();
      config = base
        ? await runInteractivePrompts(
            deps,
            httpResourceSupported,
            angularVersion,
            namingHint,
            withWorkspace(base),
          )
        : null;
    } else {
      config = await runInteractivePrompts(
        deps,
        httpResourceSupported,
        angularVersion,
        namingHint,
        withWorkspace(DEFAULT_NGX_BASE_CONFIG),
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

  if (!dryRun && config.importStyle === "alias") {
    const aliased = await offerTsconfigPatch(cwd, config, ws, {
      ask: !yes && opts.tsconfig !== false,
      skip: opts.tsconfig === false,
    });
    if (!aliased) {
      config = { ...config, importStyle: "relative" };
      p.log.info(
        pc.dim(
          "Path aliases not available — generating relative imports instead.",
        ),
      );
    }
  }

  const targets = buildGenerationTargets(cwd, config, ws);

  if (dryRun) {
    const lines: string[] = [];
    for (const t of targets) {
      const exists = await fse.pathExists(t.outPath);
      const tag = t.dirOnly
        ? pc.green("mkdir")
        : exists && t.createOnly
          ? pc.dim("keep")
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
    if (await fse.pathExists(path.join(cwd, ws.appDir, "app.config.ts"))) {
      patches.push(
        `${ws.appDir}/app.config.ts — providers (HTTP + BASE_API_URL)`,
      );
    }
    if (
      config.generateProjectStructure &&
      (await fse.pathExists(path.join(cwd, ws.appDir, "app.routes.ts")))
    ) {
      patches.push(
        `${ws.appDir}/app.routes.ts — PUBLIC/PRIVATE routes + wildcard`,
      );
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
      t.dirOnly || t.createOnly
        ? Promise.resolve(false)
        : fse.pathExists(t.outPath),
    ),
  );
  const anyExisting = existingChecks.some(Boolean);

  let overwriteAll = false;
  if (anyExisting && !yes) {
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
  // Merge into the existing manifest so entries recorded by `add` survive.
  const manifest: Manifest = await readManifest(cwd);
  for (const t of targets) {
    if (t.dirOnly) {
      await fse.ensureDir(t.outPath);
      p.log.success(pc.green(`OK: ${path.relative(cwd, t.outPath)}`));
      continue;
    }

    await fse.mkdir(path.dirname(t.outPath), { recursive: true });

    if (await fse.pathExists(t.outPath)) {
      if (t.createOnly) continue;
      if (!overwriteAll) {
        skippedExistingCount++;
        continue;
      }
    }

    const content = await renderGenerationTarget(t);
    await fse.outputFile(t.outPath, content, "utf8");
    if (!t.createOnly) {
      manifest.files[manifestKey(cwd, t.outPath)] = {
        hash: sha256(content),
        template: t.template,
      };
    }
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
    const angularResult = await patchAngularJsonFileReplacements(cwd, ws);
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

  if (config.generateProjectStructure) {
    await reportProjectStructurePatches(cwd, ws);
  }

  const appCfgResult = await patchAppConfigForHttp(cwd, config, ws);
  let noteBody: string;
  if (appCfgResult.patched) {
    noteBody = `Updated ${ws.appDir}/app.config.ts with provideHttpClient(withInterceptors(...)) and BASE_API_URL (environment.baseApiUrl).`;
    if (config.generateAuthInterceptor || config.generateProjectStructure) {
      noteBody +=
        "\nAfter login call inject(AuthTokenStore).set(token); the auth interceptor and authGuard read it.";
    }
  } else {
    noteBody = buildProviderNote(config, cwd, ws);
    if (!appCfgResult.appConfigExists) {
      noteBody =
        `No ${ws.appDir}/app.config.ts found — add bootstrap config manually:\n\n` +
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
        "httpResource: check its stability status for your Angular version — https://angular.dev/guide/http/http-resource",
      ),
    );
  }

  p.note(nextStepLines.join("\n"), "Next step");

  const dlx = dlxCommand(await detectPackageManager(cwd));
  p.note(
    [
      `${pc.cyan(`${dlx} ngx-base-cli add user`)}      ${pc.dim("# scaffold a service (inject(ApiClient))")}`,
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
  namingHint: string,
  defaults: NgxBaseCliConfig = DEFAULT_NGX_BASE_CONFIG,
): Promise<NgxBaseCliConfig | null> {
  if (httpResourceSupported) {
    p.log.info(
      pc.cyan(
        `Angular ${angularVersion}: httpResource is available for GET (Angular 19.2+).`,
      ),
    );
  } else if (deps["@angular/core"]) {
    p.log.info(
      pc.dim(
        angularVersion
          ? `Angular ${angularVersion}: httpResource option is hidden (requires Angular 19.2 or newer).`
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
          placeholder: defaults.outputDir,
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
              message: "Use httpResource for the GET method?",
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
            {
              value: "auth",
              label: "AuthInterceptor",
              hint: "Bearer token from AuthTokenStore",
            },
            {
              value: "error",
              label: "ErrorInterceptor",
              hint: "401→LOGIN_ROUTE, 403→FORBIDDEN_ROUTE, 5xx→HttpErrorBus",
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
      naming: () =>
        p.select<NamingStyle>({
          message: "File naming convention",
          options: [
            {
              value: "modern",
              label: "Modern (Angular v20+): user-card.ts / UserCard",
              hint:
                defaults.naming === "modern"
                  ? `detected: ${namingHint}`
                  : undefined,
            },
            {
              value: "suffixed",
              label: "Suffixed: user-card.component.ts / UserCardComponent",
              hint:
                defaults.naming === "suffixed"
                  ? `detected: ${namingHint}`
                  : undefined,
            },
          ],
          initialValue: defaults.naming,
        }),
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
    authTokenName: defaults.authTokenName,
    authTokenImportPath: defaults.authTokenImportPath,
    generateErrorInterceptor: interceptors.includes("error"),
    generateLoggingInterceptor: interceptors.includes("logging"),
    generateBarrel: answers.generateBarrel,
    generateProjectStructure: answers.generateProjectStructure,
    naming: answers.naming,
    project: defaults.project,
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
    ["Naming", config.naming],
    ["Base API URL", config.baseApiUrl],
    ["Import style", config.importStyle],
    ["Storage", config.storageEngine],
    ["httpResource", config.useHttpResource ? "yes" : "no"],
    ["Interceptors", interceptors.length ? interceptors.join(", ") : "none"],
    ["Barrel export", config.generateBarrel ? "yes" : "no"],
    ["Project structure", config.generateProjectStructure ? "yes" : "no"],
  ];

  const labelWidth = Math.max(...rows.map(([label]) => label.length));
  return rows
    .map(([label, value]) => `${label.padEnd(labelWidth)}  ${pc.cyan(value)}`)
    .join("\n");
}

/**
 * Ensure the path aliases exist in tsconfig.json. Returns true when the aliases
 * are available afterwards (already present or just added), false otherwise —
 * the caller then falls back to relative imports so the output still compiles.
 */
async function offerTsconfigPatch(
  cwd: string,
  config: NgxBaseCliConfig,
  ws: Workspace,
  opts: { ask: boolean; skip: boolean },
): Promise<boolean> {
  const plan = await planTsconfigAliases(cwd, pathAliases(config, ws));
  if (!plan.ok) {
    if (plan.reason === "invalid") {
      p.log.warn(pc.yellow("Could not parse tsconfig.json — skipping patch."));
    }
    return false;
  }

  const missing = Object.keys(plan.missing);
  if (missing.length === 0) {
    p.log.info("All aliases already present in tsconfig.json — nothing to do.");
    return true;
  }
  if (opts.skip) return false;

  if (opts.ask) {
    const patchAlias = await p.confirm({
      message: `Add path aliases (${missing.join(", ")}) to tsconfig.json?`,
      initialValue: true,
    });
    if (p.isCancel(patchAlias) || !patchAlias) return false;
  }

  for (const alias of missing) {
    p.log.info(
      pc.green(`  + "${alias}": ${JSON.stringify(plan.missing[alias])}`),
    );
  }
  await fse.outputFile(
    plan.file,
    applyTsconfigAliases(plan.raw, plan.missing),
    "utf8",
  );
  p.log.success(
    pc.green(
      `tsconfig.json updated (${missing.length} alias${missing.length > 1 ? "es" : ""} added).`,
    ),
  );
  return true;
}

/** Merge routes into an existing app.routes.ts and sanity-check app.html. */
async function reportProjectStructurePatches(
  cwd: string,
  ws: Workspace,
): Promise<void> {
  const routes = await patchAppRoutes(cwd, ws);
  if (routes.exists && !routes.ok) {
    p.log.warn(
      pc.yellow(
        `Could not find the \`routes\` array in ${ws.appDir}/app.routes.ts — add ...PUBLIC_ROUTES, ...PRIVATE_ROUTES manually.`,
      ),
    );
  } else if (routes.patched) {
    p.log.success(
      pc.green(`OK: ${ws.appDir}/app.routes.ts (PUBLIC/PRIVATE routes merged)`),
    );
  }

  const appHtml = path.join(cwd, ws.appDir, "app.html");
  if (await fse.pathExists(appHtml)) {
    const html = await fse.readFile(appHtml, "utf8");
    if (!html.includes("<router-outlet")) {
      p.log.warn(
        pc.yellow(
          `${ws.appDir}/app.html has no <router-outlet /> — add it (and import RouterOutlet) so the routes render.`,
        ),
      );
    }
  }
}

function buildProviderNote(
  config: NgxBaseCliConfig,
  cwd: string,
  ws: Workspace,
): string {
  const lines: string[] = [];
  const bindings = interceptorBindings(config);

  lines.push(
    `import { environment } from '${importFromSrcApp(cwd, path.join(cwd, ws.sourceRoot, "environments/environment.ts"), ws.appDir)}';`,
  );
  lines.push(
    `import { provideHttpClient, withInterceptors } from '@angular/common/http';`,
  );

  const tokensImport = importFromSrcApp(
    cwd,
    path.join(cwd, config.outputDir, apiTokensFile(config)),
    ws.appDir,
  );
  lines.push(`import { BASE_API_URL } from '${tokensImport}';`);

  for (const { name, file } of bindings) {
    const ip = importFromSrcApp(
      cwd,
      path.join(cwd, config.outputDir, file),
      ws.appDir,
    );
    lines.push(`import { ${name} } from '${ip}';`);
  }

  lines.push("");
  lines.push("// providers: [");
  lines.push(
    `  provideHttpClient(withInterceptors([${bindings.map((b) => b.name).join(", ")}])),`,
  );
  lines.push(`  { provide: BASE_API_URL, useValue: environment.baseApiUrl },`);
  lines.push("// ],");

  return lines.join("\n");
}
