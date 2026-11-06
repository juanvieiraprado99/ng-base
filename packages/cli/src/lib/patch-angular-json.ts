import path from "node:path";
import fse from "fs-extra";
import { parseJsonWithComments, setJsonValue } from "./parse-jsonc.js";
import { DEFAULT_WORKSPACE, type Workspace } from "./workspace.js";

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

/** The build target and the key it lives under (`architect` or `targets`). */
function getBuildSection(
  project: Record<string, unknown>,
):
  | { key: "architect" | "targets"; build: Record<string, unknown> }
  | undefined {
  for (const key of ["architect", "targets"] as const) {
    const section = project[key] as Record<string, unknown> | undefined;
    const build = section?.build;
    if (build && typeof build === "object") {
      return { key, build: build as Record<string, unknown> };
    }
  }
  return undefined;
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
  ws: Workspace = DEFAULT_WORKSPACE,
): Promise<PatchAngularJsonResult> {
  const ENV_REPLACE = `${ws.sourceRoot}/environments/environment.ts`;
  const ENV_WITH = `${ws.sourceRoot}/environments/environment.prod.ts`;
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

  const projectKey = ws.projectName ?? resolveApplicationProjectKey(root);
  if (!projectKey) return { ok: false };

  const project = root.projects as Record<string, unknown> | undefined;
  const proj =
    project && typeof project === "object"
      ? (project[projectKey] as Record<string, unknown> | undefined)
      : undefined;
  if (!proj) return { ok: false };

  const section = getBuildSection(proj);
  if (!section) return { ok: false };

  const configurations = section.build.configurations as
    | Record<string, Record<string, unknown> | undefined>
    | undefined;
  const current = configurations?.production?.fileReplacements;
  const list = Array.isArray(current) ? [...current] : [];
  if (fileReplacementEntryExists(list, ENV_REPLACE, ENV_WITH)) {
    return { ok: true, mutated: false };
  }
  list.push({ replace: ENV_REPLACE, with: ENV_WITH });

  // Edit only this array: comments and formatting elsewhere are preserved.
  const newContent = setJsonValue(
    raw,
    [
      "projects",
      projectKey,
      section.key,
      "build",
      "configurations",
      "production",
      "fileReplacements",
    ],
    list,
  );
  await fse.writeFile(angularJsonPath, newContent, "utf8");
  return { ok: true, mutated: true };
}
