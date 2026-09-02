import path from "node:path";
import fse from "fs-extra";
import type { AngularCapabilities } from "./angular-version.js";
import type { SpecStyle } from "./artifact-plan.js";
import { parseJsonWithComments } from "./parse-jsonc.js";

/**
 * Which runner the generated specs should target.
 *
 * Reads the project's `test` target builder when there is one — Angular 21
 * switched new projects to `@angular/build:unit-test` (Vitest), while older
 * projects still run Karma/Jasmine. Falls back to the framework default.
 */
export async function detectSpecStyle(
  cwd: string,
  caps: AngularCapabilities,
): Promise<SpecStyle> {
  const fallback: SpecStyle = caps.vitestDefault ? "vitest" : "jasmine";

  const angularJsonPath = path.join(cwd, "angular.json");
  if (!(await fse.pathExists(angularJsonPath))) return fallback;

  let root: Record<string, unknown>;
  try {
    root = parseJsonWithComments(
      await fse.readFile(angularJsonPath, "utf8"),
    ) as Record<string, unknown>;
  } catch {
    return fallback;
  }

  const builders = collectTestBuilders(root);
  if (builders.some((b) => b.includes("karma") || b.includes("jest"))) {
    return "jasmine";
  }
  if (builders.some((b) => b.includes("unit-test") || b.includes("vitest"))) {
    return "vitest";
  }
  return fallback;
}

function collectTestBuilders(root: Record<string, unknown>): string[] {
  const projects = root.projects as Record<string, unknown> | undefined;
  if (!projects || typeof projects !== "object") return [];

  const builders: string[] = [];
  for (const project of Object.values(projects)) {
    if (!project || typeof project !== "object") continue;
    for (const key of ["architect", "targets"] as const) {
      const section = (project as Record<string, unknown>)[key] as
        | Record<string, unknown>
        | undefined;
      const test = section?.test as Record<string, unknown> | undefined;
      const builder = test?.builder;
      if (typeof builder === "string") builders.push(builder);
    }
  }
  return builders;
}
