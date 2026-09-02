import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fse from "fs-extra";
import { sha256 } from "./manifest.js";

/** Project-relative location of template overrides. */
export const OVERRIDE_TEMPLATES_DIR = ".ngx-base-cli/templates";

/**
 * `dist/templates` when the bundle is `dist/index.js`; `src/templates` in dev
 * under `tsx`.
 */
export function builtInTemplatesDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const colocated = path.join(here, "templates");
  const srcSibling = path.resolve(here, "..", "templates");
  if (existsSync(colocated)) {
    return colocated;
  }
  if (existsSync(srcSibling)) {
    return srcSibling;
  }
  return colocated;
}

/** Where a project keeps its own copies of templates. */
export function overrideTemplatesDir(cwd: string): string {
  return path.join(cwd, ".ngx-base-cli", "templates");
}

async function listTplFiles(dir: string): Promise<string[]> {
  if (!(await fse.pathExists(dir))) return [];
  const entries = await fse.readdir(dir);
  return entries.filter((e) => e.endsWith(".tpl")).sort();
}

/** Every template shipped with the CLI. */
export function listBuiltInTemplates(): Promise<string[]> {
  return listTplFiles(builtInTemplatesDir());
}

/** Every template the project has ejected. */
export function listOverrideTemplates(cwd: string): Promise<string[]> {
  return listTplFiles(overrideTemplatesDir(cwd));
}

/**
 * The file to render for `name`: the project's own copy when it exists,
 * otherwise the one shipped with the CLI.
 */
export async function resolveTemplatePath(
  name: string,
  cwd: string,
): Promise<string> {
  const override = path.join(overrideTemplatesDir(cwd), name);
  if (await fse.pathExists(override)) return override;
  return path.join(builtInTemplatesDir(), name);
}

export interface EjectEntry {
  /** sha256 of the built-in template at the moment it was ejected. */
  builtInHash: string;
  /** Informational: which CLI version the copy was taken from. */
  cliVersion: string;
}

export interface EjectRegistry {
  version: number;
  templates: Record<string, EjectEntry>;
}

const EJECT_REGISTRY_VERSION = 1;

export function ejectRegistryPath(cwd: string): string {
  return path.join(cwd, ".ngx-base-cli", "templates.json");
}

export async function readEjectRegistry(cwd: string): Promise<EjectRegistry> {
  const p = ejectRegistryPath(cwd);
  if (!(await fse.pathExists(p))) {
    return { version: EJECT_REGISTRY_VERSION, templates: {} };
  }
  try {
    const parsed = JSON.parse(
      await fse.readFile(p, "utf8"),
    ) as Partial<EjectRegistry>;
    return {
      version: parsed.version ?? EJECT_REGISTRY_VERSION,
      templates: parsed.templates ?? {},
    };
  } catch {
    console.warn(
      "[ngx-base-cli] .ngx-base-cli/templates.json is not valid JSON — treating it as empty.",
    );
    return { version: EJECT_REGISTRY_VERSION, templates: {} };
  }
}

export async function writeEjectRegistry(
  cwd: string,
  registry: EjectRegistry,
): Promise<void> {
  const ordered: EjectRegistry = {
    version: EJECT_REGISTRY_VERSION,
    templates: Object.fromEntries(
      Object.entries(registry.templates).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      ),
    ),
  };
  await fse.outputFile(
    ejectRegistryPath(cwd),
    `${JSON.stringify(ordered, null, 2)}\n`,
    "utf8",
  );
}

/**
 * The CLI's own version, for the informational `cliVersion` field. Resolution
 * differs between the bundle and `tsx`, and the value is cosmetic, so a failure
 * must never break an eject.
 */
export function cliVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../../package.json") as { version: string };
    return pkg.version;
  } catch {
    return "unknown";
  }
}

export interface TemplateStatus {
  name: string;
  ejected: boolean;
  /** The built-in changed since this template was ejected. */
  stale: boolean;
  /** An override with no matching built-in — likely renamed by a newer CLI. */
  orphaned: boolean;
}

export async function templateStatuses(cwd: string): Promise<TemplateStatus[]> {
  const builtIn = await listBuiltInTemplates();
  const overrides = await listOverrideTemplates(cwd);
  const registry = await readEjectRegistry(cwd);
  const builtInSet = new Set(builtIn);

  const names = [...new Set([...builtIn, ...overrides])].sort();
  const statuses: TemplateStatus[] = [];

  for (const name of names) {
    const ejected = overrides.includes(name);
    const orphaned = ejected && !builtInSet.has(name);
    let stale = false;

    const recorded = registry.templates[name];
    if (ejected && !orphaned && recorded) {
      const current = await fse.readFile(
        path.join(builtInTemplatesDir(), name),
        "utf8",
      );
      stale = sha256(current) !== recorded.builtInHash;
    }

    statuses.push({ name, ejected, stale, orphaned });
  }

  return statuses;
}

/**
 * Map user input to a template filename. Accepts the bare name
 * (`feature.service`), the name with `.tpl`, or the full filename.
 *
 * Deliberately not a prefix match: `feature.service` would otherwise be
 * ambiguous between the template and its spec.
 */
export function resolveTemplateName(input: string, names: string[]): string {
  const candidates = [input, `${input}.tpl`, `${input}.ts.tpl`];
  const matches = names.filter((n) => candidates.includes(n));

  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    const near = names.filter((n) => n.startsWith(input.split(".")[0]));
    const hint = near.length > 0 ? ` Did you mean: ${near.join(", ")}?` : "";
    throw new Error(`Unknown template "${input}".${hint}`);
  }
  throw new Error(
    `Ambiguous template "${input}" — matches ${matches.join(", ")}. Use the full filename.`,
  );
}
