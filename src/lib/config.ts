import path from "node:path";
import fse from "fs-extra";
import {
  validateIdentifier,
  validateImportPath,
  validateRelativePath,
} from "./validators.js";

export const NGX_BASE_CLI_CONFIG_FILENAME = ".ngx-base-cli.json";

export type StorageEngine = "localStorage" | "sessionStorage" | "memory";

/**
 * Which environment file pair to generate and which `angular.json` build
 * configuration gets the `fileReplacements` entry.
 *
 * - `prod` — `environment.ts` + `environment.prod.ts`, patched into `production`
 *   (the pre-Angular-15 convention; kept for projects already set up this way).
 * - `development` — `environment.ts` + `environment.development.ts`, patched into
 *   `development` (what the Angular CLI has used since v15).
 */
export type EnvironmentStyle = "prod" | "development";

/**
 * Generated file naming.
 *
 * - `classic` — `user.service.ts`, `user.guard.ts`, `user.component.ts`
 * - `v20` — the Angular v20 style guide: `user.ts`, `user-guard.ts`, `user-store.ts`
 */
export type FileNaming = "classic" | "v20";

export interface NgxBaseCliConfig {
  outputDir: string;
  baseApiUrl: string;
  importStyle: "alias" | "relative";
  useHttpResource: boolean;
  storageEngine: StorageEngine;
  generateAuthInterceptor: boolean;
  authTokenName: string;
  authTokenImportPath: string;
  generateErrorInterceptor: boolean;
  generateLoggingInterceptor: boolean;
  generateCacheInterceptor: boolean;
  generateBarrel: boolean;
  generateProjectStructure: boolean;
  environmentStyle: EnvironmentStyle;
  fileNaming: FileNaming;
  generateSpecs: boolean;
  /**
   * Angular major version the generated code targets. `0` means "not recorded"
   * (a config written by an older CLI), in which case the version is detected
   * from the project's `package.json`.
   */
  angularTarget: number;
}

export const DEFAULT_NGX_BASE_CONFIG: NgxBaseCliConfig = {
  outputDir: "src/app/core",
  baseApiUrl: "https://api.example.com",
  importStyle: "alias",
  useHttpResource: false,
  storageEngine: "localStorage",
  generateAuthInterceptor: false,
  authTokenName: "AUTH_TOKEN",
  authTokenImportPath: "@core/tokens",
  generateErrorInterceptor: false,
  generateLoggingInterceptor: false,
  generateCacheInterceptor: false,
  generateBarrel: true,
  generateProjectStructure: false,
  // Legacy-safe fallbacks: a config written before these keys existed must keep
  // producing exactly what it produced before. `init` picks modern values for
  // new projects from the detected Angular capabilities.
  environmentStyle: "prod",
  fileNaming: "classic",
  generateSpecs: false,
  angularTarget: 0,
};

export function configPath(cwd: string): string {
  return path.join(cwd, NGX_BASE_CLI_CONFIG_FILENAME);
}

const VALID_STORAGE_ENGINES: StorageEngine[] = [
  "localStorage",
  "sessionStorage",
  "memory",
];
const VALID_IMPORT_STYLES: NgxBaseCliConfig["importStyle"][] = [
  "alias",
  "relative",
];
const VALID_ENVIRONMENT_STYLES: EnvironmentStyle[] = ["prod", "development"];
const VALID_FILE_NAMINGS: FileNaming[] = ["classic", "v20"];

const KEY_TYPES: Record<
  keyof NgxBaseCliConfig,
  "string" | "boolean" | "number"
> = {
  outputDir: "string",
  baseApiUrl: "string",
  importStyle: "string",
  useHttpResource: "boolean",
  storageEngine: "string",
  generateAuthInterceptor: "boolean",
  authTokenName: "string",
  authTokenImportPath: "string",
  generateErrorInterceptor: "boolean",
  generateLoggingInterceptor: "boolean",
  generateCacheInterceptor: "boolean",
  generateBarrel: "boolean",
  generateProjectStructure: "boolean",
  environmentStyle: "string",
  fileNaming: "string",
  generateSpecs: "boolean",
  angularTarget: "number",
};

export async function readNgxBaseConfig(
  cwd: string,
): Promise<NgxBaseCliConfig | null> {
  const p = configPath(cwd);
  if (!(await fse.pathExists(p))) return null;
  const raw = await fse.readFile(p, "utf8");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(
      `${NGX_BASE_CLI_CONFIG_FILENAME} is not valid JSON. Fix it and re-run.`,
    );
  }

  const knownKeys = Object.keys(KEY_TYPES) as (keyof NgxBaseCliConfig)[];

  for (const key of Object.keys(parsed)) {
    if (!(key in KEY_TYPES)) {
      console.warn(
        `[ngx-base-cli] Unknown config key "${key}" — ignored. ` +
          `Known keys: ${knownKeys.join(", ")}.`,
      );
    }
  }

  const validated: Partial<NgxBaseCliConfig> = {};
  for (const key of knownKeys) {
    if (parsed[key] === undefined) continue;
    if (typeof parsed[key] !== KEY_TYPES[key]) {
      console.warn(
        `[ngx-base-cli] Invalid type for "${key}" (expected ${KEY_TYPES[key]}). ` +
          `Using default "${String(DEFAULT_NGX_BASE_CONFIG[key])}".`,
      );
      continue;
    }
    (validated as Record<string, unknown>)[key] = parsed[key];
  }

  const merged: NgxBaseCliConfig = { ...DEFAULT_NGX_BASE_CONFIG, ...validated };

  if (
    parsed.storageEngine !== undefined &&
    !VALID_STORAGE_ENGINES.includes(parsed.storageEngine as StorageEngine)
  ) {
    console.warn(
      `[ngx-base-cli] Invalid storageEngine "${parsed.storageEngine}". ` +
        `Allowed: ${VALID_STORAGE_ENGINES.join(", ")}. Using default "${DEFAULT_NGX_BASE_CONFIG.storageEngine}".`,
    );
    merged.storageEngine = DEFAULT_NGX_BASE_CONFIG.storageEngine;
  }

  if (
    parsed.importStyle !== undefined &&
    !VALID_IMPORT_STYLES.includes(
      parsed.importStyle as NgxBaseCliConfig["importStyle"],
    )
  ) {
    console.warn(
      `[ngx-base-cli] Invalid importStyle "${parsed.importStyle}". ` +
        `Allowed: ${VALID_IMPORT_STYLES.join(", ")}. Using default "${DEFAULT_NGX_BASE_CONFIG.importStyle}".`,
    );
    merged.importStyle = DEFAULT_NGX_BASE_CONFIG.importStyle;
  }

  if (
    parsed.environmentStyle !== undefined &&
    !VALID_ENVIRONMENT_STYLES.includes(
      parsed.environmentStyle as EnvironmentStyle,
    )
  ) {
    console.warn(
      `[ngx-base-cli] Invalid environmentStyle "${parsed.environmentStyle}". ` +
        `Allowed: ${VALID_ENVIRONMENT_STYLES.join(", ")}. Using default "${DEFAULT_NGX_BASE_CONFIG.environmentStyle}".`,
    );
    merged.environmentStyle = DEFAULT_NGX_BASE_CONFIG.environmentStyle;
  }

  if (
    parsed.fileNaming !== undefined &&
    !VALID_FILE_NAMINGS.includes(parsed.fileNaming as FileNaming)
  ) {
    console.warn(
      `[ngx-base-cli] Invalid fileNaming "${parsed.fileNaming}". ` +
        `Allowed: ${VALID_FILE_NAMINGS.join(", ")}. Using default "${DEFAULT_NGX_BASE_CONFIG.fileNaming}".`,
    );
    merged.fileNaming = DEFAULT_NGX_BASE_CONFIG.fileNaming;
  }

  if (!Number.isInteger(merged.angularTarget) || merged.angularTarget < 0) {
    console.warn(
      `[ngx-base-cli] Invalid angularTarget "${merged.angularTarget}" (expected a non-negative integer). ` +
        `Falling back to version detection.`,
    );
    merged.angularTarget = DEFAULT_NGX_BASE_CONFIG.angularTarget;
  }

  const outputDirError = validateRelativePath(merged.outputDir);
  if (outputDirError) {
    console.warn(
      `[ngx-base-cli] Invalid outputDir "${merged.outputDir}": ${outputDirError} ` +
        `Using default "${DEFAULT_NGX_BASE_CONFIG.outputDir}".`,
    );
    merged.outputDir = DEFAULT_NGX_BASE_CONFIG.outputDir;
  }

  const tokenImportError = validateImportPath(merged.authTokenImportPath);
  if (tokenImportError) {
    console.warn(
      `[ngx-base-cli] Invalid authTokenImportPath "${merged.authTokenImportPath}": ${tokenImportError} ` +
        `Using default "${DEFAULT_NGX_BASE_CONFIG.authTokenImportPath}".`,
    );
    merged.authTokenImportPath = DEFAULT_NGX_BASE_CONFIG.authTokenImportPath;
  }

  const tokenNameError = validateIdentifier(merged.authTokenName);
  if (tokenNameError) {
    console.warn(
      `[ngx-base-cli] Invalid authTokenName "${merged.authTokenName}": ${tokenNameError} ` +
        `Using default "${DEFAULT_NGX_BASE_CONFIG.authTokenName}".`,
    );
    merged.authTokenName = DEFAULT_NGX_BASE_CONFIG.authTokenName;
  }

  return merged;
}

export async function writeNgxBaseConfig(
  cwd: string,
  config: NgxBaseCliConfig,
): Promise<void> {
  await fse.outputFile(
    configPath(cwd),
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8",
  );
}
