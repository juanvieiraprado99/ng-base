import path from "node:path";
import fse from "fs-extra";

/**
 * Extrai a versão semver principal de um range npm (ex: ^19.1.0 → 19.1.0).
 */
export function parseAngularCoreVersion(
  range: string | undefined,
): string | null {
  if (!range) return null;
  const cleaned = range.replace(/^[\^~>=\s]+/, "").trim();
  const match = cleaned.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;
  const patch = match[3] ?? "0";
  return `${match[1]}.${match[2]}.${patch}`;
}

/** Split `"19.1.0"` into `[major, minor]`; `null` → `[0, 0]`. */
export function majorMinor(version: string | null): [number, number] {
  if (!version) return [0, 0];
  const parts = version.split(".").map((p) => Number.parseInt(p, 10));
  return [parts[0] ?? 0, parts[1] ?? 0];
}

/** `httpResource` exists (as an experimental API) from Angular 19.1. */
export function versionSupportsHttpResource(version: string | null): boolean {
  const [major, minor] = majorMinor(version);
  return major > 19 || (major === 19 && minor >= 1);
}

/**
 * Which framework features the generated code may rely on. Drives every
 * version-dependent decision in `generate-plan.ts` and `artifact-plan.ts`, so
 * a single project can be served correctly from Angular 19 through 22+.
 */
export interface AngularCapabilities {
  /** `0` when the version could not be determined. */
  major: number;
  minor: number;
  /** `httpResource` exists at all (experimental in 19.1–21). */
  httpResourceAvailable: boolean;
  /** Resource API graduated to stable in v22 — no more experimental warning. */
  httpResourceStable: boolean;
  /** v22 made `OnPush` the default, so an explicit `changeDetection` is noise. */
  onPushIsDefault: boolean;
  /** v22 added `@Service()` as the ergonomic form of `@Injectable({providedIn:'root'})`. */
  serviceDecorator: boolean;
  /** v21 made zoneless change detection the default for new projects. */
  zonelessDefault: boolean;
  /** v21 made Vitest the default unit-test runner (`@angular/build:unit-test`). */
  vitestDefault: boolean;
  /** Signal Forms became stable in v22. */
  signalFormsStable: boolean;
  /** v20 style guide: `user-guard.ts` / `user-store.ts` instead of `user.guard.ts`. */
  newFileNaming: boolean;
}

/** Capabilities for an explicit major (and optional minor) version. */
export function capabilitiesForMajor(
  major: number,
  minor = 99,
): AngularCapabilities {
  return {
    major,
    minor,
    httpResourceAvailable: major > 19 || (major === 19 && minor >= 1),
    httpResourceStable: major >= 22,
    onPushIsDefault: major >= 22,
    serviceDecorator: major >= 22,
    zonelessDefault: major >= 21,
    vitestDefault: major >= 21,
    signalFormsStable: major >= 22,
    newFileNaming: major >= 20,
  };
}

/**
 * Capabilities for a parsed version string. An unknown version yields the
 * conservative all-false set, so the CLI generates code that works everywhere.
 */
export function detectCapabilities(
  version: string | null,
): AngularCapabilities {
  const [major, minor] = majorMinor(version);
  return capabilitiesForMajor(major, minor);
}

/** Read `@angular/core`'s version from the target project's `package.json`. */
export async function readAngularVersion(cwd: string): Promise<string | null> {
  const pkgPath = path.join(cwd, "package.json");
  if (!(await fse.pathExists(pkgPath))) return null;
  try {
    const pkg = JSON.parse(await fse.readFile(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return parseAngularCoreVersion(
      pkg.dependencies?.["@angular/core"] ??
        pkg.devDependencies?.["@angular/core"],
    );
  } catch {
    return null;
  }
}

/**
 * Capabilities for a project: the version recorded in `.ngx-base-cli.json` wins
 * (so `update` reproduces what `init` generated), otherwise fall back to what
 * is installed on disk.
 */
export async function resolveCapabilities(
  cwd: string,
  angularTarget: number,
): Promise<AngularCapabilities> {
  if (angularTarget > 0) return capabilitiesForMajor(angularTarget);
  return detectCapabilities(await readAngularVersion(cwd));
}
