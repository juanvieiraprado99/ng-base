import path from "node:path";
import { importBetweenFiles } from "./import-paths.js";
import { kebabName, pascalName } from "./naming.js";
import { coreFiles, type NamingStyle } from "./naming-style.js";

export interface PlannedService {
  outPath: string;
  className: string;
  vars: Record<string, string>;
}

/**
 * `<outputDir>/services/<name>` for `generate service`:
 * - suffixed: `user.service.ts` / `UserService`
 * - modern (Angular v20 style guide, like `ng g service`): `user.ts` / `UserService`
 */
export function planService(
  rawName: string,
  cwd: string,
  outputDir: string,
  opts: { naming?: NamingStyle; endpoint?: string } = {},
): PlannedService {
  const naming = opts.naming ?? "suffixed";
  const kebab = kebabName(rawName);
  const className = `${pascalName(rawName) || "Feature"}Service`;
  const base = naming === "suffixed" ? `${kebab}.service` : kebab;
  const outPath = path.join(cwd, outputDir, "services", `${base}.ts`);
  const apiClient = path.join(cwd, outputDir, coreFiles(naming).apiClient);
  const endpoint = (opts.endpoint ?? `/${kebab}`).trim();
  return {
    outPath,
    className,
    vars: {
      SERVICE_CLASS_NAME: className,
      API_CLIENT_IMPORT: importBetweenFiles(outPath, apiClient),
      ENDPOINT: JSON.stringify(
        endpoint.startsWith("/") ? endpoint : `/${endpoint}`,
      ),
    },
  };
}
