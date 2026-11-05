import path from "node:path";
import * as p from "@clack/prompts";
import fse from "fs-extra";
import pc from "picocolors";
import type { ModuleId, NgBaseConfig } from "./config.js";
import {
  buildModuleTargets,
  getModule,
  type InstallId,
  installedIds,
  interceptorBindings,
  pathAliases,
  privateRoutesFile,
  sortIds,
  withModules,
} from "./modules.js";
import { patchAngularJsonFileReplacements } from "./patch-angular-json.js";
import { patchAppConfigForHttp } from "./patch-app-config.js";
import { patchAppRoutes } from "./patch-app-routes.js";
import { applyTsconfigAliases, planTsconfigAliases } from "./patch-tsconfig.js";
import { renderGenerationTarget } from "./render-target.js";
import type { Workspace } from "./workspace.js";

export interface InstallOptions {
  /** No prompts: existing files are kept (unless `overwrite`). */
  yes?: boolean;
  /** Replace files that already exist. */
  overwrite?: boolean;
  dryRun?: boolean;
  /** false = never touch tsconfig.json (falls back to relative imports). */
  tsconfig?: boolean;
}

export interface InstallResult {
  /** Config after the install (modules added; importStyle may fall back). */
  config: NgBaseConfig;
  written: string[];
  kept: string[];
}

const rel = (cwd: string, file: string) =>
  path.relative(cwd, file).replace(/\\/g, "/");

/**
 * Copies the files of `ids` into the project and wires them up (tsconfig
 * aliases, angular.json, app.config.ts, app.routes.ts). Existing files are
 * never replaced without `overwrite` or a yes to the prompt — after install the
 * code belongs to the project. Returns null when the user cancels.
 */
export async function installModules(
  cwd: string,
  base: NgBaseConfig,
  ws: Workspace,
  requested: readonly InstallId[],
  opts: InstallOptions = {},
): Promise<InstallResult | null> {
  const ids = sortIds(requested);
  const added = ids.filter((id): id is ModuleId => id !== "core");
  let config = withModules(base, added);

  // Aliases first: if they can't be added, render relative imports instead.
  let renderConfig = config;
  if (config.importStyle === "alias" && !opts.dryRun) {
    const ok = await ensureTsconfigAliases(cwd, config, ws, ids, opts);
    if (!ok) {
      renderConfig = { ...config, importStyle: "relative" };
      // At init the whole project switches; later modules just use ../ imports.
      if (ids.includes("core")) config = renderConfig;
      p.log.info(
        pc.dim("Path aliases not available — using relative imports."),
      );
    }
  }

  const targets = buildModuleTargets(cwd, renderConfig, ws, ids);
  const exists = await Promise.all(
    targets.map((t) => fse.pathExists(t.outPath)),
  );
  const conflicts = targets.filter((t, i) => exists[i] && !t.createOnly);

  if (opts.dryRun) {
    const lines = targets.map((t, i) => {
      const tag = !exists[i]
        ? pc.green("create")
        : t.createOnly
          ? pc.dim("keep  ")
          : opts.overwrite
            ? pc.yellow("overwrite")
            : pc.dim("keep  ");
      return `${tag}  ${rel(cwd, t.outPath)}`;
    });
    p.note(lines.join("\n"), `Files (${ids.join(", ")})`);
    return { config, written: [], kept: [] };
  }

  let overwrite = opts.overwrite ?? false;
  if (conflicts.length > 0 && !overwrite && !opts.yes) {
    const answer = await p.confirm({
      message: `${conflicts.length} file(s) already exist:\n${conflicts
        .map((t) => `  ${rel(cwd, t.outPath)}`)
        .join("\n")}\nOverwrite them? (No keeps your versions)`,
      initialValue: false,
    });
    if (p.isCancel(answer)) {
      p.cancel("Cancelled.");
      return null;
    }
    overwrite = answer;
  }

  const written: string[] = [];
  const kept: string[] = [];
  for (const [i, t] of targets.entries()) {
    if (exists[i] && (t.createOnly || !overwrite)) {
      if (!t.createOnly) kept.push(rel(cwd, t.outPath));
      continue;
    }
    await fse.outputFile(t.outPath, await renderGenerationTarget(t), "utf8");
    written.push(rel(cwd, t.outPath));
    p.log.success(pc.green(`OK: ${rel(cwd, t.outPath)}`));
  }
  if (kept.length > 0) {
    p.log.info(pc.dim(`Kept ${kept.length} existing file(s) unchanged.`));
  }

  if (ids.includes("core")) await patchAngularJson(cwd, ws);
  if (ids.includes("layout")) await patchRoutes(cwd, ws);
  if (ids.some((id) => getModule(id).interceptor)) {
    await patchAppConfig(cwd, renderConfig, ws);
  }

  return { config, written, kept };
}

async function ensureTsconfigAliases(
  cwd: string,
  config: NgBaseConfig,
  ws: Workspace,
  ids: readonly InstallId[],
  opts: InstallOptions,
): Promise<boolean> {
  const wanted = pathAliases(config, ws, [...installedIds(config), ...ids]);
  const plan = await planTsconfigAliases(cwd, wanted);
  if (!plan.ok) {
    if (plan.reason === "invalid") {
      p.log.warn(pc.yellow("Could not parse tsconfig.json — skipping patch."));
    }
    return false;
  }
  const missing = Object.keys(plan.missing);
  if (missing.length === 0) return true;
  if (opts.tsconfig === false) return false;

  if (!opts.yes) {
    const ok = await p.confirm({
      message: `Add path aliases (${missing.join(", ")}) to tsconfig.json?`,
      initialValue: true,
    });
    if (p.isCancel(ok) || !ok) return false;
  }
  await fse.outputFile(
    plan.file,
    applyTsconfigAliases(plan.raw, plan.missing),
    "utf8",
  );
  p.log.success(pc.green(`OK: tsconfig.json (${missing.join(", ")})`));
  return true;
}

async function patchAngularJson(cwd: string, ws: Workspace): Promise<void> {
  if (!(await fse.pathExists(path.join(cwd, "angular.json")))) return;
  const result = await patchAngularJsonFileReplacements(cwd, ws);
  if (!result.ok) {
    p.log.warn(
      pc.yellow(
        "Could not update angular.json (parse error or no application build target). Add fileReplacements for environments manually.",
      ),
    );
  } else if (result.mutated) {
    p.log.success(pc.green("OK: angular.json (production fileReplacements)"));
  }
}

/** Merge routes into an existing app.routes.ts and sanity-check app.html. */
async function patchRoutes(cwd: string, ws: Workspace): Promise<void> {
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

async function patchAppConfig(
  cwd: string,
  config: NgBaseConfig,
  ws: Workspace,
): Promise<void> {
  const file = `${ws.appDir}/app.config.ts`;
  const result = await patchAppConfigForHttp(cwd, config, ws);
  const names = interceptorBindings(config).map((b) => b.name);
  if (result.patched) {
    p.log.success(pc.green(`OK: ${file} (interceptors: ${names.join(", ")})`));
  } else if (!result.appConfigExists || result.manual) {
    p.log.warn(
      pc.yellow(
        `${result.appConfigExists ? `Could not find \`providers\` in ${file}` : `No ${file}`} — add to your bootstrap config:\n\n${result.manual ?? `provideHttpClient(withInterceptors([${names.join(", ")}])),\n{ provide: BASE_API_URL, useValue: environment.baseApiUrl }`}`,
      ),
    );
  }
}

/** Next steps of the installed modules, plus cross-module hints. */
export async function printNextSteps(
  cwd: string,
  before: NgBaseConfig,
  ws: Workspace,
  ids: readonly InstallId[],
): Promise<void> {
  const lines: string[] = [];
  for (const id of sortIds(ids)) {
    const spec = getModule(id);
    lines.push(pc.bold(spec.title));
    for (const note of spec.notes) lines.push(`  ${note}`);
  }

  // auth after layout: the private route was generated without a guard.
  if (ids.includes("auth") && before.modules.includes("layout")) {
    const routes = privateRoutesFile(path.join(cwd, ws.appDir));
    if (
      (await fse.pathExists(routes)) &&
      !(await fse.readFile(routes, "utf8")).includes("authGuard")
    ) {
      lines.push(
        "",
        pc.yellow(
          `${rel(cwd, routes)} has no guard yet — add \`canMatch: [authGuard]\` to the private route.`,
        ),
      );
    }
  }
  if (lines.length > 0) p.note(lines.join("\n"), "Next steps");
}
