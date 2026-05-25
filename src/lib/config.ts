import path from "node:path";
import fse from "fs-extra";
import {
  validateIdentifier,
  validateImportPath,
  validateRelativePath,
} from "./validators.js";

export const NGX_BASE_CLI_CONFIG_FILENAME = ".ngx-base-cli.json";

export type StorageEngine = "localStorage" | "sessionStorage" | "memory";

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
  generateBarrel: boolean;
  generateProjectStructure: boolean;
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
  generateBarrel: true,
  generateProjectStructure: false,
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

const KEY_TYPES: Record<keyof NgxBaseCliConfig, "string" | "boolean"> = {
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
  generateBarrel: "boolean",
  generateProjectStructure: "boolean",
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
