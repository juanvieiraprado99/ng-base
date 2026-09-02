import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fse from "fs-extra";

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
