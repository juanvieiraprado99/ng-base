import path from "node:path";
import * as p from "@clack/prompts";
import fse from "fs-extra";
import pc from "picocolors";
import {
  parseAngularCoreVersion,
  versionSupportsHttpResource,
} from "../lib/angular-version.js";
import {
  DEFAULT_CONFIG,
  isModuleId,
  MODULE_IDS,
  type ModuleId,
  type NgBaseConfig,
  readNgBaseConfig,
  type StorageEngine,
  writeNgBaseConfig,
} from "../lib/config.js";
import { installModules, printNextSteps } from "../lib/install.js";
import { getModule } from "../lib/modules.js";
import {
  detectNamingStyle,
  NAMING_STYLES,
  type NamingStyle,
} from "../lib/naming-style.js";
import { detectPackageManager, dlxCommand } from "../lib/package-manager.js";
import { validateUrl } from "../lib/validators.js";
import { resolveWorkspace, type Workspace } from "../lib/workspace.js";

export interface InitOptions {
  /** Non-interactive: no prompts; existing files are kept. */
  yes?: boolean;
  dryRun?: boolean;
  /** Replace files that already exist. */
  overwrite?: boolean;
  /** BASE_API_URL written to the environment files. */
  apiUrl?: string;
  /** Cache storage: local | session | memory. */
  storage?: string;
  /** Modules to add right away (comma-separated or list). */
  with?: string | string[];
  /** Add every module. */
  all?: boolean;
  /** @deprecated 0.1 presets, mapped to `with`. */
  preset?: string;
  /** Skip the tsconfig.json path-alias patch (falls back to relative imports). */
  tsconfig?: boolean;
  /** angular.json project to target (default: auto-detect). */
  project?: string;
  /** File naming convention: auto (detect), modern or suffixed. */
  naming?: string;
}

const NAMING_CHOICES = ["auto", ...NAMING_STYLES] as const;

const STORAGE_CHOICES: Record<string, StorageEngine> = {
  local: "localStorage",
  session: "sessionStorage",
  memory: "memory",
  localStorage: "localStorage",
  sessionStorage: "sessionStorage",
};

const LEGACY_PRESETS: Record<string, ModuleId[]> = {
  minimal: [],
  standard: ["auth", "errors"],
  full: ["auth", "errors", "layout"],
};

function fail(message: string): void {
  p.outro(pc.red(message));
  process.exitCode = 1;
}

/** Parses `--with a,b` / `--all` / `--preset` into module ids. */
function requestedModules(
  opts: InitOptions,
): { ok: true; ids: ModuleId[] | null } | { ok: false; error: string } {
  if (opts.all) return { ok: true, ids: [...MODULE_IDS] };
  if (opts.preset !== undefined) {
    const ids = LEGACY_PRESETS[opts.preset];
    if (!ids) {
      return {
        ok: false,
        error: `Unknown preset "${opts.preset}". Presets are deprecated — use --with ${MODULE_IDS.join(",")} or --all.`,
      };
    }
    p.log.warn(
      pc.yellow(
        `--preset is deprecated: same as ${ids.length ? `--with ${ids.join(",")}` : "no --with"}.`,
      ),
    );
    return { ok: true, ids };
  }
  if (opts.with === undefined) return { ok: true, ids: null };
  const raw = (Array.isArray(opts.with) ? opts.with : [opts.with])
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
  const unknown = raw.filter((v) => !isModuleId(v));
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Unknown module(s): ${unknown.join(", ")}. Available: ${MODULE_IDS.join(", ")}.`,
    };
  }
  return { ok: true, ids: raw as ModuleId[] };
}

async function readAngularDeps(
  cwd: string,
): Promise<Record<string, string> | string> {
  const pkgPath = path.join(cwd, "package.json");
  if (!(await fse.pathExists(pkgPath))) {
    return "package.json not found. Run this command from the project root.";
  }
  try {
    const pkg = JSON.parse(await fse.readFile(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return "package.json is not valid JSON. Fix it and re-run.";
  }
}

export async function runInit(
  cwd: string = process.cwd(),
  opts: InitOptions = {},
): Promise<void> {
  const yes = opts.yes ?? false;
  p.intro(pc.inverse(" ng-base init "));

  if (
    opts.naming !== undefined &&
    !(NAMING_CHOICES as readonly string[]).includes(opts.naming)
  ) {
    return fail(
      `Unknown naming "${opts.naming}". Use one of: ${NAMING_CHOICES.join(", ")}.`,
    );
  }
  const storageFlag =
    opts.storage === undefined ? undefined : STORAGE_CHOICES[opts.storage];
  if (opts.storage !== undefined && !storageFlag) {
    return fail(
      `Unknown storage "${opts.storage}". Use one of: local, session, memory.`,
    );
  }
  if (opts.apiUrl !== undefined) {
    const error = validateUrl(opts.apiUrl);
    if (error) return fail(`Invalid --api-url: ${error}`);
  }
  const modulesFlag = requestedModules(opts);
  if (!modulesFlag.ok) return fail(modulesFlag.error);

  const deps = await readAngularDeps(cwd);
  if (typeof deps === "string") return fail(deps);
  if (!deps["@angular/core"]) {
    if (yes) {
      p.log.warn(
        pc.yellow("@angular/core is not listed in dependencies — continuing."),
      );
    } else {
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
  }
  const angularVersion = parseAngularCoreVersion(deps["@angular/core"]);

  let ws: Workspace;
  try {
    ws = await resolveWorkspace(cwd, opts.project);
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }

  const existing = await readNgBaseConfig(cwd);
  if (existing) {
    p.log.info(
      pc.dim(
        "Already initialized — re-installing the core; existing files are kept. Add modules with `ng-base add`.",
      ),
    );
  }

  const angularMajor = angularVersion
    ? Number.parseInt(angularVersion, 10)
    : null;
  const detected = await detectNamingStyle(cwd, ws, angularMajor);
  const forcedNaming =
    opts.naming === "modern" || opts.naming === "suffixed"
      ? (opts.naming as NamingStyle)
      : undefined;
  const naming = forcedNaming ?? existing?.naming ?? detected.style;

  p.log.info(
    pc.dim(
      [
        ws.projectName &&
          `Project: ${ws.projectName} (${ws.appDir}, prefix "${ws.prefix}")`,
        `Naming: ${naming} (${forcedNaming ? "--naming" : existing ? ".ng-base.json" : detected.reason})`,
        angularVersion && `Angular ${angularVersion}`,
      ]
        .filter(Boolean)
        .join(" · "),
    ),
  );

  let config: NgBaseConfig = {
    ...DEFAULT_CONFIG,
    outputDir: `${ws.appDir}/core`,
    useHttpResource: versionSupportsHttpResource(angularVersion),
    ...existing,
    naming,
    // Pin the resolved project so a later angular.json change cannot retarget.
    project: opts.project ?? existing?.project ?? ws.projectName ?? "",
    ...(opts.apiUrl ? { baseApiUrl: opts.apiUrl } : {}),
    ...(storageFlag ? { storageEngine: storageFlag } : {}),
  };

  let extra: ModuleId[] = modulesFlag.ids ?? [];
  if (!yes) {
    const answers = await promptInit(config, modulesFlag.ids === null, {
      apiUrl: opts.apiUrl === undefined && !existing,
      storage: storageFlag === undefined && !existing,
    });
    if (!answers) return;
    config = { ...config, ...answers.config };
    if (answers.modules) extra = answers.modules;
  }

  const result = await installModules(cwd, config, ws, ["core", ...extra], {
    yes,
    overwrite: opts.overwrite,
    dryRun: opts.dryRun,
    tsconfig: opts.tsconfig,
  });
  if (!result) return;
  if (opts.dryRun) {
    p.outro(pc.green("Dry run complete — nothing was written."));
    return;
  }

  await writeNgBaseConfig(cwd, result.config);
  await printNextSteps(cwd, config, ws, ["core", ...extra]);

  const dlx = dlxCommand(await detectPackageManager(cwd));
  const rest = MODULE_IDS.filter((id) => !result.config.modules.includes(id));
  p.note(
    [
      ...rest.map(
        (id) =>
          `${pc.cyan(`${dlx} ng-base add ${id}`.padEnd(32))} ${pc.dim(getModule(id).description)}`,
      ),
      `${pc.cyan(`${dlx} ng-base generate service user`.padEnd(32))} ${pc.dim("service using ApiClient")}`,
      `${pc.cyan(`${dlx} ng-base doctor`.padEnd(32))} ${pc.dim("check the setup")}`,
    ].join("\n"),
    "More",
  );
  p.outro(
    pc.green(
      "Done — the code is yours now: edit it freely, ng-base won't touch it again.",
    ),
  );
}

async function promptInit(
  config: NgBaseConfig,
  askModules: boolean,
  ask: { apiUrl: boolean; storage: boolean },
): Promise<{ config: Partial<NgBaseConfig>; modules?: ModuleId[] } | null> {
  const out: Partial<NgBaseConfig> = {};
  if (ask.apiUrl) {
    const apiUrl = await p.text({
      message: "API base URL (BASE_API_URL)",
      initialValue: config.baseApiUrl,
      placeholder: "https://api.example.com",
      validate: (value) => validateUrl(String(value)),
    });
    if (p.isCancel(apiUrl)) return cancelled();
    out.baseApiUrl = String(apiUrl).trim();
  }
  if (ask.storage) {
    const storage = await p.select<StorageEngine>({
      message: "Where should cached responses live?",
      options: [
        {
          value: "localStorage",
          label: "localStorage",
          hint: "survives reloads",
        },
        {
          value: "sessionStorage",
          label: "sessionStorage",
          hint: "per browser tab",
        },
        { value: "memory", label: "memory", hint: "per app instance / SSR" },
      ],
      initialValue: config.storageEngine,
    });
    if (p.isCancel(storage)) return cancelled();
    out.storageEngine = storage;
  }
  if (!askModules) return { config: out };

  const available = MODULE_IDS.filter((id) => !config.modules.includes(id));
  if (available.length === 0) return { config: out };
  const modules = await p.multiselect<ModuleId>({
    message:
      "Add modules now? (space to toggle, enter to continue — you can `ng-base add` them later)",
    options: available.map((id) => ({
      value: id,
      label: id,
      hint: getModule(id).description,
    })),
    required: false,
  });
  if (p.isCancel(modules)) return cancelled();
  return { config: out, modules };
}

function cancelled(): null {
  p.cancel("Cancelled.");
  return null;
}
