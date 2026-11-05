import path from "node:path";
import fse from "fs-extra";
import { parseJsonWithComments, setJsonValue } from "./parse-jsonc.js";

type Tsconfig = {
  compilerOptions?: { paths?: Record<string, string[]>; baseUrl?: string };
};

export type TsconfigAliasPlan =
  | { ok: false; reason: "missing" | "invalid" }
  | {
      ok: true;
      file: string;
      raw: string;
      /** `"@core/*"` → `["./src/app/core/*"]`, only for aliases not yet present. */
      missing: Record<string, string[]>;
    };

/**
 * Work out which path aliases (alias → project-relative dir) are missing from
 * `tsconfig.json`. Targets honour an existing `baseUrl`; without one (it is
 * deprecated in TS 6) they are relative to the tsconfig dir.
 */
export async function planTsconfigAliases(
  cwd: string,
  aliases: Record<string, string>,
): Promise<TsconfigAliasPlan> {
  const file = path.join(cwd, "tsconfig.json");
  if (!(await fse.pathExists(file))) return { ok: false, reason: "missing" };
  const raw = await fse.readFile(file, "utf8");
  let tsconfig: Tsconfig;
  try {
    tsconfig = (parseJsonWithComments(raw) ?? {}) as Tsconfig;
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const baseUrl = tsconfig.compilerOptions?.baseUrl;
  const existing = tsconfig.compilerOptions?.paths ?? {};
  const toTarget = (dir: string): string =>
    baseUrl
      ? `${path.posix.relative(baseUrl.replace(/\\/g, "/"), dir) || "."}/*`
      : `./${dir}/*`;

  const missing: Record<string, string[]> = {};
  for (const [alias, dir] of Object.entries(aliases)) {
    const key = `${alias}/*`;
    if (!existing[key]) missing[key] = [toTarget(dir)];
  }
  return { ok: true, file, raw, missing };
}

/** Insert the aliases into the tsconfig text, preserving comments and formatting. */
export function applyTsconfigAliases(
  raw: string,
  missing: Record<string, string[]>,
): string {
  let out = raw;
  for (const [alias, targets] of Object.entries(missing)) {
    out = setJsonValue(out, ["compilerOptions", "paths", alias], targets);
  }
  return out;
}
