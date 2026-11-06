import path from "node:path";
import fse from "fs-extra";
import { parseJsonWithComments } from "./parse-jsonc.js";

/**
 * Where an Angular application lives inside the workspace. Every path is posix
 * and relative to the workspace root (the directory holding angular.json).
 */
export interface Workspace {
  /** angular.json project key, or null when there is no angular.json. */
  projectName: string | null;
  /** Project source root, e.g. `src` or `projects/admin/src`. */
  sourceRoot: string;
  /** `<sourceRoot>/app`. */
  appDir: string;
  /** Component/directive selector prefix (angular.json `prefix`, default `app`). */
  prefix: string;
  /** Raw `schematics` block of the project merged over the workspace one. */
  schematics: Record<string, Record<string, unknown>>;
}

export const DEFAULT_WORKSPACE: Workspace = {
  projectName: null,
  sourceRoot: "src",
  appDir: "src/app",
  prefix: "app",
  schematics: {},
};

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function hasBuildTarget(project: Json): boolean {
  const targets = (project.architect ?? project.targets) as Json | undefined;
  return isObject(targets) && isObject(targets.build);
}

/**
 * Pick the application project: the requested one, else `defaultProject`, else
 * the only/first `application` project, else the first with a build target.
 */
export function resolveProjectName(
  angularJson: Json,
  requested?: string,
): string | null {
  const projects = angularJson.projects;
  if (!isObject(projects)) return null;

  if (requested) {
    if (!isObject(projects[requested])) {
      throw new Error(
        `Project "${requested}" not found in angular.json. Available: ${Object.keys(projects).join(", ")}.`,
      );
    }
    return requested;
  }

  const def =
    typeof angularJson.defaultProject === "string"
      ? angularJson.defaultProject
      : "";
  if (def && isObject(projects[def])) return def;

  const entries = Object.entries(projects).filter(([, p]) => isObject(p)) as [
    string,
    Json,
  ][];
  const app = entries.find(([, p]) => p.projectType === "application");
  if (app) return app[0];
  const buildable = entries.find(([, p]) => hasBuildTarget(p));
  return buildable?.[0] ?? entries[0]?.[0] ?? null;
}

const toPosix = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "");

/** Build a Workspace from parsed angular.json content. */
export function workspaceFromAngularJson(
  angularJson: Json,
  requested?: string,
): Workspace {
  const name = resolveProjectName(angularJson, requested);
  if (!name) return { ...DEFAULT_WORKSPACE };
  const project = (angularJson.projects as Json)[name] as Json;

  const root = typeof project.root === "string" ? toPosix(project.root) : "";
  const sourceRoot =
    typeof project.sourceRoot === "string" && project.sourceRoot.trim()
      ? toPosix(project.sourceRoot)
      : path.posix.join(root || ".", "src");
  const prefix =
    typeof project.prefix === "string" && project.prefix.trim()
      ? project.prefix.trim()
      : "app";

  const schematics: Workspace["schematics"] = {};
  for (const block of [angularJson.schematics, project.schematics]) {
    if (!isObject(block)) continue;
    for (const [key, value] of Object.entries(block)) {
      if (isObject(value)) schematics[key] = { ...schematics[key], ...value };
    }
  }

  const normalizedSource = path.posix.normalize(sourceRoot);
  return {
    projectName: name,
    sourceRoot: normalizedSource,
    appDir: path.posix.join(normalizedSource, "app"),
    prefix,
    schematics,
  };
}

/**
 * Read angular.json in `cwd` and resolve the target application. Falls back to
 * the conventional `src/app` layout when there is no (parsable) angular.json.
 * Throws only when an explicitly requested project does not exist.
 */
export async function resolveWorkspace(
  cwd: string,
  requested?: string,
): Promise<Workspace> {
  const file = path.join(cwd, "angular.json");
  if (!(await fse.pathExists(file))) return { ...DEFAULT_WORKSPACE };
  let json: Json;
  try {
    json = parseJsonWithComments(await fse.readFile(file, "utf8")) as Json;
  } catch {
    return { ...DEFAULT_WORKSPACE };
  }
  return workspaceFromAngularJson(json, requested || undefined);
}
