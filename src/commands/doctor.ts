import path from "node:path";
import * as p from "@clack/prompts";
import fse from "fs-extra";
import pc from "picocolors";
import type { NgxBaseCliConfig } from "../lib/config.js";
import { readNgxBaseConfig } from "../lib/config.js";
import { parseJsonWithComments } from "../lib/parse-jsonc.js";

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
  p.intro(pc.inverse(" ngx-base-cli doctor "));

  const config = await readNgxBaseConfig(cwd);
  if (!config) {
    p.outro(
      pc.red(".ngx-base-cli.json not found. Run `ngx-base-cli init` first."),
    );
    process.exitCode = 1;
    return;
  }

  const checks: Check[] = [];

  await checkBaseFiles(checks, cwd, config);
  await checkEnvironments(checks, cwd);
  await checkAliases(checks, cwd, config);
  await checkAppConfig(checks, cwd, config);
  await checkAuthToken(checks, cwd, config);

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

async function checkBaseFiles(
  checks: Check[],
  cwd: string,
  config: NgxBaseCliConfig,
): Promise<void> {
  const base = path.join(cwd, config.outputDir);
  const files: [string, string][] = [
    ["interfaces/cache.interface.ts", "cache.interface.ts"],
    ["services/cache.service.ts", "cache.service.ts"],
    ["services/base.service.ts", "base.service.ts"],
  ];
  for (const [rel, label] of files) {
    const exists = await fse.pathExists(path.join(base, rel));
    checks.push({
      level: exists ? "ok" : "error",
      label: `${label} present`,
      detail: exists
        ? undefined
        : `Expected at ${config.outputDir}/${rel}. Run \`ngx-base-cli init\`.`,
    });
  }
}

async function checkEnvironments(checks: Check[], cwd: string): Promise<void> {
  for (const file of ["environment.ts", "environment.prod.ts"]) {
    const exists = await fse.pathExists(
      path.join(cwd, "src/environments", file),
    );
    checks.push({
      level: exists ? "ok" : "warn",
      label: `environments/${file}`,
      detail: exists ? undefined : "Missing — run `ngx-base-cli init`.",
    });
  }
}

async function checkAliases(
  checks: Check[],
  cwd: string,
  config: NgxBaseCliConfig,
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

  const required = ["@core/*"];
  const structural = ["@layout/*", "@pages/*", "@shared/*"];

  for (const alias of required) {
    const has = alias in paths;
    checks.push({
      level: has ? "ok" : "error",
      label: `alias ${alias}`,
      detail: has
        ? undefined
        : "Add it to tsconfig.json compilerOptions.paths.",
    });
  }
  if (config.generateProjectStructure) {
    for (const alias of structural) {
      const has = alias in paths;
      checks.push({
        level: has ? "ok" : "warn",
        label: `alias ${alias}`,
        detail: has
          ? undefined
          : "Used by generated layout/pages/shared files.",
      });
    }
  }
}

async function checkAppConfig(
  checks: Check[],
  cwd: string,
  config: NgxBaseCliConfig,
): Promise<void> {
  const appConfigPath = path.join(cwd, "src/app/app.config.ts");
  if (!(await fse.pathExists(appConfigPath))) {
    checks.push({
      level: "warn",
      label: "app.config.ts providers",
      detail: "src/app/app.config.ts not found — configure providers manually.",
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

  const wantsInterceptors =
    config.generateAuthInterceptor ||
    config.generateErrorInterceptor ||
    config.generateLoggingInterceptor;
  if (wantsInterceptors) {
    const has = content.includes("withInterceptors");
    checks.push({
      level: has ? "ok" : "warn",
      label: "withInterceptors(...)",
      detail: has
        ? undefined
        : "Interceptors generated but not wired via withInterceptors(...).",
    });
  }
}

async function checkAuthToken(
  checks: Check[],
  cwd: string,
  config: NgxBaseCliConfig,
): Promise<void> {
  if (!config.generateAuthInterceptor) return;

  const appConfigPath = path.join(cwd, "src/app/app.config.ts");
  let provided = false;
  if (await fse.pathExists(appConfigPath)) {
    const content = await fse.readFile(appConfigPath, "utf8");
    provided = content.includes(config.authTokenName);
  }
  checks.push({
    level: provided ? "ok" : "warn",
    label: `${config.authTokenName} provided`,
    detail: provided
      ? undefined
      : `AuthInterceptor needs ${config.authTokenName} provided (import from ${config.authTokenImportPath}).`,
  });
}
