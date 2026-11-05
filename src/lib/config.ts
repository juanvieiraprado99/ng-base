import path from "node:path";
import fse from "fs-extra";
import { NAMING_STYLES, type NamingStyle } from "./naming-style.js";
import { validateRelativePath } from "./validators.js";

export const CONFIG_FILENAME = ".ngx-base-cli.json";
/** Manifest written by 0.1 — no longer used. */
export const LEGACY_MANIFEST_FILENAME = ".ngx-base-cli.manifest.json";

export type StorageEngine = "localStorage" | "sessionStorage" | "memory";

/** Optional modules installable with `ngx-base-cli add` (the core comes with `init`). */
export const MODULE_IDS = ["auth", "errors", "logging", "layout"] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export function isModuleId(value: string): value is ModuleId {
  return (MODULE_IDS as readonly string[]).includes(value);
}

export interface NgBaseConfig {
  outputDir: string;
  baseApiUrl: string;
  importStyle: "alias" | "relative";
  useHttpResource: boolean;
  storageEngine: StorageEngine;
  /**
   * File/class naming convention of generated code. `init` detects it; configs
   * written before it existed default to "suffixed" (the original behavior).
   */
  naming: NamingStyle;
  /** angular.json project to target; empty = auto-detect. */
  project: string;
  /** Modules installed with `add` (or `init --with`), in install order. */
  modules: ModuleId[];
}

export const DEFAULT_CONFIG: NgBaseConfig = {
  outputDir: "src/app/core",
  baseApiUrl: "https://api.example.com",
  importStyle: "alias",
  useHttpResource: false,
  storageEngine: "localStorage",
  naming: "suffixed",
  project: "",
  modules: [],
};

export function configPath(cwd: string): string {
  return path.join(cwd, CONFIG_FILENAME);
}

/** Where the published JSON Schema lives (used as `$schema` in the config). */
export const CONFIG_SCHEMA_URL = "https://unpkg.com/ngx-base-cli/schema.json";

interface ConfigField {
  type: "string" | "boolean" | "array";
  description: string;
  /** Allowed values (for arrays: allowed items). */
  enum?: readonly string[];
  /** Returns an error message for an invalid value. */
  validate?: (value: string) => string | undefined;
}

/**
 * Single source of truth for `.ngx-base-cli.json`: drives runtime validation in
 * `readNgBaseConfig` and the published JSON Schema (`buildConfigJsonSchema`).
 */
export const CONFIG_FIELDS: { [K in keyof NgBaseConfig]: ConfigField } = {
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
    description: "ApiClient.resource() for httpResource (Angular 19.2+).",
  },
  storageEngine: {
    type: "string",
    enum: ["localStorage", "sessionStorage", "memory"],
    description: "CACHE_STORAGE backend for the response cache (SSR-safe).",
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
  modules: {
    type: "array",
    enum: MODULE_IDS,
    description:
      "Modules installed with `ngx-base-cli add` (auth, errors, logging, layout).",
  },
};

/** Keys accepted in the file besides the config fields. */
const META_KEYS = new Set(["$schema"]);

/** ngx-base-cli 0.1 flags, mapped to the module they turned on. */
const LEGACY_FLAGS: Record<string, ModuleId | null> = {
  generateAuthInterceptor: "auth",
  generateErrorInterceptor: "errors",
  generateLoggingInterceptor: "logging",
  generateProjectStructure: "layout",
  generateBarrel: null,
  authTokenName: null,
  authTokenImportPath: null,
};

/** JSON Schema (draft-07) for `.ngx-base-cli.json`, built from CONFIG_FIELDS. */
export function buildConfigJsonSchema(): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    $schema: { type: "string" },
  };
  for (const [key, field] of Object.entries(CONFIG_FIELDS)) {
    const enumValues = field.enum ? [...field.enum] : undefined;
    properties[key] = {
      type: field.type,
      description: field.description,
      ...(field.type === "array"
        ? {
            items: {
              type: "string",
              ...(enumValues ? { enum: enumValues } : {}),
            },
            uniqueItems: true,
          }
        : enumValues
          ? { enum: enumValues }
          : {}),
      default: DEFAULT_CONFIG[key as keyof NgBaseConfig],
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

function typeOf(value: unknown): ConfigField["type"] | string {
  return Array.isArray(value) ? "array" : typeof value;
}

/** Validates a parsed config object, falling back to defaults per key. */
export function parseConfig(parsed: Record<string, unknown>): NgBaseConfig {
  const knownKeys = Object.keys(CONFIG_FIELDS) as (keyof NgBaseConfig)[];
  for (const key of Object.keys(parsed)) {
    if (!(key in CONFIG_FIELDS) && !META_KEYS.has(key)) {
      warn(
        `Unknown config key "${key}" — ignored. Known keys: ${knownKeys.join(", ")}.`,
      );
    }
  }

  const merged: NgBaseConfig = { ...DEFAULT_CONFIG, modules: [] };
  for (const key of knownKeys) {
    const value = parsed[key];
    if (value === undefined) continue;
    const field = CONFIG_FIELDS[key];
    const fallback = `Using default ${JSON.stringify(DEFAULT_CONFIG[key])}.`;
    if (typeOf(value) !== field.type) {
      warn(`Invalid type for "${key}" (expected ${field.type}). ${fallback}`);
      continue;
    }
    if (field.type === "array") {
      const items: string[] = [];
      for (const item of value as unknown[]) {
        if (
          typeof item !== "string" ||
          (field.enum && !field.enum.includes(item))
        ) {
          warn(
            `Invalid ${key} entry ${JSON.stringify(item)} — ignored. Allowed: ${field.enum?.join(", ")}.`,
          );
        } else if (!items.includes(item)) {
          items.push(item);
        }
      }
      (merged as unknown as Record<string, unknown>)[key] = items;
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

/** Converts a 0.1 config (generate* flags) to the modules format. */
export function migrateLegacyConfig(
  legacy: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const modules: ModuleId[] = [];
  for (const [key, value] of Object.entries(legacy)) {
    if (key === "$schema") continue;
    if (key in LEGACY_FLAGS) {
      const id = LEGACY_FLAGS[key];
      if (id && value === true) modules.push(id);
      continue;
    }
    out[key] = value;
  }
  out.modules = MODULE_IDS.filter((id) => modules.includes(id));
  return out;
}

function parseJsonFile(raw: string, file: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  throw new Error(`${file} is not a valid JSON object. Fix it and re-run.`);
}

/** Whether a parsed config still uses the 0.1 `generate*` flags. */
export function isLegacyConfig(parsed: Record<string, unknown>): boolean {
  return Object.keys(parsed).some((key) => key in LEGACY_FLAGS);
}

/**
 * Reads `.ngx-base-cli.json`. A 0.1 config (`generate*` flags, no `modules`)
 * is migrated in place to the modules format.
 */
export async function readNgBaseConfig(
  cwd: string,
): Promise<NgBaseConfig | null> {
  const p = configPath(cwd);
  if (!(await fse.pathExists(p))) return null;
  const parsed = parseJsonFile(await fse.readFile(p, "utf8"), CONFIG_FILENAME);
  if (!isLegacyConfig(parsed)) return parseConfig(parsed);

  const config = parseConfig(migrateLegacyConfig(parsed));
  await writeNgBaseConfig(cwd, config);
  warn(
    `Migrated ${CONFIG_FILENAME} to the 0.2 format (modules: ${config.modules.join(", ") || "none"}).`,
  );
  return config;
}

export async function writeNgBaseConfig(
  cwd: string,
  config: NgBaseConfig,
): Promise<void> {
  // `$schema` first gives editors autocomplete/validation for the file.
  const file = { $schema: CONFIG_SCHEMA_URL, ...config };
  await fse.outputFile(
    configPath(cwd),
    `${JSON.stringify(file, null, 2)}\n`,
    "utf8",
  );
}
