import path from "node:path";
import fse from "fs-extra";
import { parseJsonWithComments } from "./parse-jsonc.js";

const ENV_REPLACE = "src/environments/environment.ts";
const ENV_WITH = "src/environments/environment.prod.ts";

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

function getBuildSection(
  project: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const architect = project.architect as Record<string, unknown> | undefined;
  const targets = project.targets as Record<string, unknown> | undefined;
  const build =
    (architect?.build as Record<string, unknown> | undefined) ??
    (targets?.build as Record<string, unknown> | undefined);
  return build && typeof build === "object" ? build : undefined;
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

/** Idempotent patch: ensure production build replaces environment.ts with environment.prod.ts. */
export async function patchAngularJsonFileReplacements(
  cwd: string,
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

  const projectKey = resolveApplicationProjectKey(root);
  if (!projectKey) return { ok: false };

  const project = root.projects as Record<string, unknown> | undefined;
  const proj =
    project && typeof project === "object"
      ? (project[projectKey] as Record<string, unknown> | undefined)
      : undefined;
  if (!proj) return { ok: false };

  const build = getBuildSection(proj);
  if (!build) return { ok: false };

  let mutated = false;

  if (!build.configurations || typeof build.configurations !== "object") {
    build.configurations = {};
  }

  const configurations = build.configurations as Record<
    string,
    Record<string, unknown>
  >;

  const production = configurations.production;
  if (!production || typeof production !== "object") {
    configurations.production = {
      fileReplacements: [{ replace: ENV_REPLACE, with: ENV_WITH }],
    };
    mutated = true;
  } else if (!production.fileReplacements) {
    production.fileReplacements = [{ replace: ENV_REPLACE, with: ENV_WITH }];
    mutated = true;
  } else {
    if (!Array.isArray(production.fileReplacements)) {
      production.fileReplacements = [];
      mutated = true;
    }
    const fr = production.fileReplacements as Array<{
      replace: string;
      with: string;
    }>;
    if (!fileReplacementEntryExists(fr, ENV_REPLACE, ENV_WITH)) {
      fr.push({ replace: ENV_REPLACE, with: ENV_WITH });
      mutated = true;
    }
  }

  if (!mutated) {
    return { ok: true, mutated: false };
  }

  const newContent = `${JSON.stringify(root, null, 2)}\n`;
  await fse.writeFile(angularJsonPath, newContent, "utf8");
  return { ok: true, mutated: true };
}
