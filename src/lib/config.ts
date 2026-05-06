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
  generateBarrel: true,
  generateProjectStructure: false,
};

export function configPath(cwd: string): string {
  return path.join(cwd, NGX_BASE_CLI_CONFIG_FILENAME);
}

export async function readNgxBaseConfig(
  cwd: string
): Promise<NgxBaseCliConfig | null> {
  const p = configPath(cwd);
  if (!(await fse.pathExists(p))) return null;
  const raw = await fse.readFile(p, "utf8");
  const parsed = JSON.parse(raw) as Partial<NgxBaseCliConfig>;
  return { ...DEFAULT_NGX_BASE_CONFIG, ...parsed };
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
