import fse from "fs-extra";
import path from "node:path";

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

export async function readNgxBaseConfig(
  cwd: string
): Promise<NgxBaseCliConfig | null> {
  const p = configPath(cwd);
  if (!(await fse.pathExists(p))) return null;
  const raw = await fse.readFile(p, "utf8");
  const parsed = JSON.parse(raw) as Partial<NgxBaseCliConfig>;

  const merged: NgxBaseCliConfig = { ...DEFAULT_NGX_BASE_CONFIG, ...parsed };

  if (
    parsed.storageEngine !== undefined &&
    !VALID_STORAGE_ENGINES.includes(parsed.storageEngine as StorageEngine)
  ) {
    console.warn(
      `[ngx-base-cli] Invalid storageEngine "${parsed.storageEngine}". ` +
        `Allowed: ${VALID_STORAGE_ENGINES.join(", ")}. Using default "${DEFAULT_NGX_BASE_CONFIG.storageEngine}".`
    );
    merged.storageEngine = DEFAULT_NGX_BASE_CONFIG.storageEngine;
  }

  if (
    parsed.importStyle !== undefined &&
    !VALID_IMPORT_STYLES.includes(
      parsed.importStyle as NgxBaseCliConfig["importStyle"]
    )
  ) {
    console.warn(
      `[ngx-base-cli] Invalid importStyle "${parsed.importStyle}". ` +
        `Allowed: ${VALID_IMPORT_STYLES.join(", ")}. Using default "${DEFAULT_NGX_BASE_CONFIG.importStyle}".`
    );
    merged.importStyle = DEFAULT_NGX_BASE_CONFIG.importStyle;
  }

  return merged;
}

export async function writeNgxBaseConfig(
  cwd: string,
  config: NgxBaseCliConfig
): Promise<void> {
  await fse.outputFile(
    configPath(cwd),
    JSON.stringify(config, null, 2) + "\n",
    "utf8"
  );
}
