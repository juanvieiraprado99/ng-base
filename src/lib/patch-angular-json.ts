import path from "node:path";
import fse from "fs-extra";
import type { EnvironmentStyle } from "./config.js";
import { parseJsonWithComments } from "./parse-jsonc.js";
import { editJsonText, type JsonEdit } from "./patch-json.js";

export interface EnvFileReplacement {
  /** `angular.json` build configuration that gets the entry. */
  configuration: string;
  replace: string;
  with: string;
}

const ENV_DIR = "src/environments";

/** The `fileReplacements` entry implied by a config's `environmentStyle`. */
export function envFileReplacement(
  style: EnvironmentStyle,
): EnvFileReplacement {
  return style === "development"
    ? {
        configuration: "development",
        replace: `${ENV_DIR}/environment.ts`,
        with: `${ENV_DIR}/environment.development.ts`,
      }
    : {
        configuration: "production",
        replace: `${ENV_DIR}/environment.ts`,
        with: `${ENV_DIR}/environment.prod.ts`,
      };
}

function normalizeConfigPath(p: string): string {
  return p.replace(/\\/g, "/");
}

function fileReplacementEntryExists(
  list: unknown,
  replace: string,
  withPath: string,
): boolean {
  if (!Array.isArray(list)) return false;
  const r = normalizeConfigPath(replace);
  const w = normalizeConfigPath(withPath);
  return list.some(
    (e) =>
      e &&
      typeof e === "object" &&
      normalizeConfigPath(String((e as { replace?: string }).replace)) === r &&
      normalizeConfigPath(String((e as { with?: string }).with)) === w,
  );
}

/** `architect` (classic) or `targets` (workspace v2) — whichever this project uses. */
function buildSectionKey(
  project: Record<string, unknown>,
): "architect" | "targets" | null {
  for (const key of ["architect", "targets"] as const) {
    const section = project[key] as Record<string, unknown> | undefined;
    const build = section?.build;
    if (build && typeof build === "object") return key;
  }
  return null;
}

function getBuildSection(
  project: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const key = buildSectionKey(project);
  if (!key) return undefined;
  return (project[key] as Record<string, unknown>).build as Record<
    string,
    unknown
  >;
}

function resolveApplicationProjectKey(
  root: Record<string, unknown>,
): string | null {
  const projects = root.projects as Record<string, unknown> | undefined;
  if (!projects || typeof projects !== "object") return null;

  const defaultProject =
    typeof root.defaultProject === "string" ? root.defaultProject.trim() : "";
  if (defaultProject && projects[defaultProject]) {
    return defaultProject;
  }

  for (const [name, proj] of Object.entries(projects)) {
    if (!proj || typeof proj !== "object") continue;
    const p = proj as Record<string, unknown>;
    if (p.projectType === "application") return name;
    if (getBuildSection(p)) return name;
  }

  const keys = Object.keys(projects);
  return keys[0] ?? null;
}

export type PatchAngularJsonResult =
  | { ok: true; mutated: boolean }
  | { ok: false };

/**
 * Idempotent patch: ensure the target build configuration replaces
 * `environment.ts` with its environment-specific counterpart.
 *
 * Edits are applied with `jsonc-parser` so comments, key order and the file's
 * own indentation survive — a full re-serialize would strip all of them.
 */
export async function patchAngularJsonFileReplacements(
  cwd: string,
  style: EnvironmentStyle = "prod",
): Promise<PatchAngularJsonResult> {
  const angularJsonPath = path.join(cwd, "angular.json");
  if (!(await fse.pathExists(angularJsonPath))) {
    return { ok: false };
  }

  const raw = await fse.readFile(angularJsonPath, "utf8");
  let root: Record<string, unknown>;
  try {
    root = parseJsonWithComments(raw) as Record<string, unknown>;
  } catch {
    return { ok: false };
  }
  if (!root || typeof root !== "object") return { ok: false };

  const projectKey = resolveApplicationProjectKey(root);
  if (!projectKey) return { ok: false };

  const projects = root.projects as Record<string, unknown> | undefined;
  const proj =
    projects && typeof projects === "object"
      ? (projects[projectKey] as Record<string, unknown> | undefined)
      : undefined;
  if (!proj) return { ok: false };

  const sectionKey = buildSectionKey(proj);
  const build = getBuildSection(proj);
  if (!sectionKey || !build) return { ok: false };

  const target = envFileReplacement(style);
  const entry = { replace: target.replace, with: target.with };

  const buildPath = ["projects", projectKey, sectionKey, "build"];
  const configPath = [...buildPath, "configurations", target.configuration];
  const replacementsPath = [...configPath, "fileReplacements"];

  const configurations = build.configurations as
    | Record<string, unknown>
    | undefined;
  const configuration =
    configurations && typeof configurations === "object"
      ? (configurations[target.configuration] as
          | Record<string, unknown>
          | undefined)
      : undefined;

  const edits: JsonEdit[] = [];

  if (!configurations || typeof configurations !== "object") {
    edits.push({
      path: [...buildPath, "configurations"],
      value: { [target.configuration]: { fileReplacements: [entry] } },
    });
  } else if (!configuration || typeof configuration !== "object") {
    edits.push({ path: configPath, value: { fileReplacements: [entry] } });
  } else if (!Array.isArray(configuration.fileReplacements)) {
    edits.push({ path: replacementsPath, value: [entry] });
  } else if (
    !fileReplacementEntryExists(
      configuration.fileReplacements,
      target.replace,
      target.with,
    )
  ) {
    edits.push({
      path: [...replacementsPath, configuration.fileReplacements.length],
      value: entry,
      isArrayInsertion: true,
    });
  }

  if (edits.length === 0) {
    return { ok: true, mutated: false };
  }

  await fse.writeFile(angularJsonPath, editJsonText(raw, edits), "utf8");
  return { ok: true, mutated: true };
}
