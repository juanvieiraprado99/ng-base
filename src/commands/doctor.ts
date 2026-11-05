import path from "node:path";
import * as p from "@clack/prompts";
import fse from "fs-extra";
import pc from "picocolors";
import {
  LEGACY_MANIFEST_FILENAME,
  type NgBaseConfig,
  readNgBaseConfig,
} from "../lib/config.js";
import {
  buildModuleTargets,
  installedIds,
  interceptorBindings,
  pathAliases,
} from "../lib/modules.js";
import { parseJsonWithComments } from "../lib/parse-jsonc.js";
import { resolveWorkspace, type Workspace } from "../lib/workspace.js";

type Level = "ok" | "warn" | "error";

interface Check {
  level: Level;
  label: string;
  detail?: string;
}

const ICON: Record<Level, string> = {
  ok: pc.green("OK"),
  warn: pc.yellow("!!"),
  error: pc.red("XX"),
};

export async function runDoctor(cwd: string = process.cwd()): Promise<void> {
  p.intro(pc.inverse(" ng-base doctor "));

  const config = await readNgBaseConfig(cwd);
  if (!config) {
    p.outro(pc.red(".ng-base.json not found. Run `ng-base init` first."));
    process.exitCode = 1;
    return;
  }

  const checks: Check[] = [];
  const ws = await resolveWorkspace(cwd, config.project);

  await checkModuleFiles(checks, cwd, config, ws);
  await checkEnvironments(checks, cwd, ws);
  await checkAliases(checks, cwd, config, ws);
  await checkAppConfig(checks, cwd, config, ws);
  await checkLegacyFiles(checks, cwd);

  const maxLen = Math.max(...checks.map((c) => c.label.length));
  const body = checks
    .map((c) => {
      const line = `${ICON[c.level]}  ${c.label.padEnd(maxLen)}`;
      return c.detail ? `${line}\n      ${pc.dim(c.detail)}` : line;
    })
    .join("\n");
  p.note(body, "Diagnostics");

  const errors = checks.filter((c) => c.level === "error").length;
  const warns = checks.filter((c) => c.level === "warn").length;

  if (errors > 0) process.exitCode = 1;

  if (errors === 0 && warns === 0) {
    p.outro(pc.green("All checks passed."));
  } else {
    const parts: string[] = [];
    if (errors) parts.push(pc.red(`${errors} error(s)`));
    if (warns) parts.push(pc.yellow(`${warns} warning(s)`));
    p.outro(parts.join(pc.dim(" · ")));
  }
}

async function checkModuleFiles(
  checks: Check[],
  cwd: string,
  config: NgBaseConfig,
  ws: Workspace,
): Promise<void> {
  for (const id of installedIds(config)) {
    const targets = buildModuleTargets(cwd, config, ws, [id]).filter(
      (t) =>
        !t.createOnly &&
        !t.outPath.includes(`${path.sep}environments${path.sep}`),
    );
    const missing: string[] = [];
    for (const t of targets) {
      if (!(await fse.pathExists(t.outPath))) {
        missing.push(path.relative(cwd, t.outPath).replace(/\\/g, "/"));
      }
    }
    checks.push({
      // Moving or deleting copied files is the user's call; the core is required.
      level: missing.length === 0 ? "ok" : id === "core" ? "error" : "warn",
      label: `${id} files (${targets.length - missing.length}/${targets.length})`,
      detail:
        missing.length === 0
          ? undefined
          : `Not found (moved or deleted?): ${missing.join(", ")}`,
    });
  }
}

async function checkEnvironments(
  checks: Check[],
  cwd: string,
  ws: Workspace,
): Promise<void> {
  for (const file of ["environment.ts", "environment.prod.ts"]) {
    const exists = await fse.pathExists(
      path.join(cwd, ws.sourceRoot, "environments", file),
    );
    checks.push({
      level: exists ? "ok" : "warn",
      label: `environments/${file}`,
      detail: exists ? undefined : "Missing — run `ng-base init`.",
    });
  }
}

async function checkAliases(
  checks: Check[],
  cwd: string,
  config: NgBaseConfig,
  ws: Workspace,
): Promise<void> {
  if (config.importStyle !== "alias") return;

  const tsconfigPath = path.join(cwd, "tsconfig.json");
  if (!(await fse.pathExists(tsconfigPath))) {
    checks.push({
      level: "warn",
      label: "tsconfig.json path aliases",
      detail: "tsconfig.json not found — cannot verify @core/* alias.",
    });
    return;
  }

  let paths: Record<string, unknown> = {};
  try {
    const raw = await fse.readFile(tsconfigPath, "utf8");
    const parsed = parseJsonWithComments(raw) as {
      compilerOptions?: { paths?: Record<string, unknown> };
    };
    paths = parsed.compilerOptions?.paths ?? {};
  } catch {
    checks.push({
      level: "warn",
      label: "tsconfig.json path aliases",
      detail: "Could not parse tsconfig.json.",
    });
    return;
  }

  for (const alias of Object.keys(pathAliases(config, ws))) {
    const key = `${alias}/*`;
    const has = key in paths;
    checks.push({
      level: has ? "ok" : alias === "@core" ? "error" : "warn",
      label: `alias ${key}`,
      detail: has
        ? undefined
        : "Add it to tsconfig.json compilerOptions.paths.",
    });
  }
}

async function checkAppConfig(
  checks: Check[],
  cwd: string,
  config: NgBaseConfig,
  ws: Workspace,
): Promise<void> {
  const appConfigPath = path.join(cwd, ws.appDir, "app.config.ts");
  if (!(await fse.pathExists(appConfigPath))) {
    checks.push({
      level: "warn",
      label: "app.config.ts providers",
      detail: `${ws.appDir}/app.config.ts not found — configure providers manually.`,
    });
    return;
  }

  const content = await fse.readFile(appConfigPath, "utf8");

  checks.push({
    level: content.includes("provideHttpClient") ? "ok" : "error",
    label: "provideHttpClient()",
    detail: content.includes("provideHttpClient")
      ? undefined
      : "Add provideHttpClient(...) to app.config.ts providers.",
  });

  checks.push({
    level: content.includes("BASE_API_URL") ? "ok" : "error",
    label: "BASE_API_URL provider",
    detail: content.includes("BASE_API_URL")
      ? undefined
      : "Provide BASE_API_URL with environment.baseApiUrl.",
  });

  for (const { name } of interceptorBindings(config)) {
    const has = content.includes(name);
    checks.push({
      level: has ? "ok" : name === "cacheInterceptor" ? "error" : "warn",
      label: `${name} registered`,
      detail: has
        ? undefined
        : `Add ${name} to withInterceptors([...]) in app.config.ts.`,
    });
  }
}

async function checkLegacyFiles(checks: Check[], cwd: string): Promise<void> {
  if (await fse.pathExists(path.join(cwd, LEGACY_MANIFEST_FILENAME))) {
    checks.push({
      level: "warn",
      label: `${LEGACY_MANIFEST_FILENAME} (unused)`,
      detail: "Left over from ngx-base-cli 0.1 — safe to delete.",
    });
  }
}
