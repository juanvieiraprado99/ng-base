import path from "node:path";
import fse from "fs-extra";
import { NAMING_STYLES, type NamingStyle } from "./naming-style.js";
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
  /** @deprecated Unused since the auth interceptor reads AuthTokenStore. Kept for config compatibility. */
  authTokenName: string;
  /** @deprecated Unused since the auth interceptor reads AuthTokenStore. Kept for config compatibility. */
  authTokenImportPath: string;
  generateErrorInterceptor: boolean;
  generateLoggingInterceptor: boolean;
  generateBarrel: boolean;
  generateProjectStructure: boolean;
  /**
   * File/class naming convention of generated code. `init` detects it; configs
   * written before it existed default to "suffixed" (the original behavior).
   */
  naming: NamingStyle;
  /** angular.json project to target; empty = auto-detect. */
  project: string;
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
  naming: "suffixed",
  project: "",
};

export function configPath(cwd: string): string {
  return path.join(cwd, NGX_BASE_CLI_CONFIG_FILENAME);
}

/** Where the published JSON Schema lives (used as `$schema` in the config). */
export const CONFIG_SCHEMA_URL = "https://unpkg.com/ngx-base-cli/schema.json";

interface ConfigField {
  type: "string" | "boolean";
  description: string;
  enum?: readonly string[];
  deprecated?: boolean;
  /** Returns an error message for an invalid value. */
  validate?: (value: string) => string | undefined;
}

/**
 * Single source of truth for `.ngx-base-cli.json`: drives runtime validation in
 * `readNgxBaseConfig` and the published JSON Schema (`buildConfigJsonSchema`).
 */
export const CONFIG_FIELDS: { [K in keyof NgxBaseCliConfig]: ConfigField } = {
  outputDir: {
    type: "string",
    description:
      "Folder (relative to the project root) where the core is generated.",
    validate: validateRelativePath,
  },
  baseApiUrl: {
    type: "string",
    description:
      "API base URL written to src/environments/environment*.ts (BASE_API_URL).",
  },
  importStyle: {
    type: "string",
    enum: ["alias", "relative"],
    description:
      "alias = @core/@layout/@pages/@shared (tsconfig paths); relative = ../ imports.",
  },
  useHttpResource: {
    type: "boolean",
    description: "Add ApiClient.resource() for httpResource (Angular 19.2+).",
  },
  storageEngine: {
    type: "string",
    enum: ["localStorage", "sessionStorage", "memory"],
    description: "CACHE_STORAGE backend for the response cache (SSR-safe).",
  },
  generateAuthInterceptor: {
    type: "boolean",
    description:
      "Generate the auth interceptor, AuthTokenStore and AUTH_ALLOWED_URLS.",
  },
  authTokenName: {
    type: "string",
    deprecated: true,
    description:
      "Deprecated and ignored: the auth interceptor reads AuthTokenStore.",
    validate: validateIdentifier,
  },
  authTokenImportPath: {
    type: "string",
    deprecated: true,
    description:
      "Deprecated and ignored: the auth interceptor reads AuthTokenStore.",
    validate: validateImportPath,
  },
  generateErrorInterceptor: {
    type: "boolean",
    description:
      "Generate the error interceptor (HttpErrorBus, LOGIN_ROUTE / FORBIDDEN_ROUTE redirects).",
  },
  generateLoggingInterceptor: {
    type: "boolean",
    description: "Generate a dev-only request logging interceptor.",
  },
  generateBarrel: {
    type: "boolean",
    description: "Generate services/index.ts re-exporting the core services.",
  },
  generateProjectStructure: {
    type: "boolean",
    description:
      "Generate layout/, pages/, routes/ (with authGuard) and shared/, and merge app.routes.ts.",
  },
  naming: {
    type: "string",
    enum: NAMING_STYLES,
    description:
      'File/class naming: "modern" (user-card.ts, Angular v20 style guide) or "suffixed" (user-card.component.ts). Missing = "suffixed".',
  },
  project: {
    type: "string",
    description: "angular.json project to target; empty = auto-detect.",
  },
};

/** Keys accepted in the file besides the config fields. */
const META_KEYS = new Set(["$schema"]);

/** JSON Schema (draft-07) for `.ngx-base-cli.json`, built from CONFIG_FIELDS. */
export function buildConfigJsonSchema(): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    $schema: { type: "string" },
  };
  for (const [key, field] of Object.entries(CONFIG_FIELDS)) {
    properties[key] = {
      type: field.type,
      description: field.description,
      ...(field.enum ? { enum: [...field.enum] } : {}),
      ...(field.deprecated ? { deprecated: true } : {}),
      default: DEFAULT_NGX_BASE_CONFIG[key as keyof NgxBaseCliConfig],
    };
  }
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: CONFIG_SCHEMA_URL,
    title: "ngx-base-cli config (.ngx-base-cli.json)",
    type: "object",
    properties,
    additionalProperties: false,
  };
}

const warn = (msg: string) => console.warn(`[ngx-base-cli] ${msg}`);

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

  const knownKeys = Object.keys(CONFIG_FIELDS) as (keyof NgxBaseCliConfig)[];
  for (const key of Object.keys(parsed)) {
    if (!(key in CONFIG_FIELDS) && !META_KEYS.has(key)) {
      warn(
        `Unknown config key "${key}" — ignored. Known keys: ${knownKeys.join(", ")}.`,
      );
    }
  }

  const merged: NgxBaseCliConfig = { ...DEFAULT_NGX_BASE_CONFIG };
  for (const key of knownKeys) {
    const value = parsed[key];
    if (value === undefined) continue;
    const field = CONFIG_FIELDS[key];
    const fallback = `Using default "${String(DEFAULT_NGX_BASE_CONFIG[key])}".`;
    if (typeof value !== field.type) {
      warn(`Invalid type for "${key}" (expected ${field.type}). ${fallback}`);
      continue;
    }
    if (field.enum && !field.enum.includes(value as string)) {
      warn(
        `Invalid ${key} "${String(value)}". Allowed: ${field.enum.join(", ")}. ${fallback}`,
      );
      continue;
    }
    const error = field.validate?.(value as string);
    if (error) {
      warn(`Invalid ${key} "${String(value)}": ${error} ${fallback}`);
      continue;
    }
    (merged as unknown as Record<string, unknown>)[key] = value;
  }
  return merged;
}

export async function writeNgxBaseConfig(
  cwd: string,
  config: NgxBaseCliConfig,
): Promise<void> {
  // `$schema` first gives editors autocomplete/validation for the file.
  const file = { $schema: CONFIG_SCHEMA_URL, ...config };
  await fse.outputFile(
    configPath(cwd),
    `${JSON.stringify(file, null, 2)}\n`,
    "utf8",
  );
}
