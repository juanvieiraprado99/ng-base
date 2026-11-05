import path from "node:path";
import fse from "fs-extra";
import { importBetweenFiles } from "./import-paths.js";
import {
  type AddType,
  camelName,
  kebabName,
  pascalName,
  symbolName,
} from "./naming.js";
import { coreFiles, type NamingStyle } from "./naming-style.js";

export type ComponentStyle = "scss" | "css" | "none";

export const COMPONENT_STYLES: ComponentStyle[] = ["scss", "css", "none"];

export interface PlannedFile {
  outPath: string;
  template: string;
  vars: Record<string, string>;
}

export interface AddOptions {
  inlineTemplate?: boolean;
  style?: ComponentStyle;
  /** Naming convention (default "suffixed"). */
  naming?: NamingStyle;
  /** Selector prefix from angular.json (default "app"). */
  prefix?: string;
  /**
   * Project-relative folder for reusable UI. Components go to
   * `<sharedDir>/components/` (core is for app-wide singletons); without it
   * they fall back to `<outputDir>/components/`.
   */
  sharedDir?: string;
}

export type PlanResult =
  | { ok: true; files: PlannedFile[] }
  | { ok: false; error: string };

interface ArtifactName {
  /** Folder under outputDir. */
  folder: string;
  /** File name without `.ts`. */
  base: string;
  /** Class / const identifier. */
  symbol: string;
}

/**
 * Folder, file base and identifier for an artifact.
 * - suffixed: `user.service.ts` / `UserService`, `auth.guard.ts` / `authGuard`.
 * - modern (Angular v20 style guide + `ng g`): `user.ts` / `UserService`,
 *   `user-card.ts` / `UserCard`, `auth-guard.ts` / `authGuard`,
 *   `user.model.ts` / `User`.
 */
export function artifactName(
  type: AddType,
  rawName: string,
  naming: NamingStyle = "suffixed",
): ArtifactName {
  const kebab = kebabName(rawName);
  const pascal = pascalName(rawName) || "Feature";
  const folders: Record<AddType, string> = {
    service: "services",
    component: `components/${kebab}`,
    guard: "guards",
    resolver: "resolvers",
    pipe: "pipes",
    directive: "directives",
    interface: "interfaces",
    store: "stores",
    enum: "enum",
  };
  const folder = folders[type];

  if (naming === "suffixed") {
    return {
      folder,
      base: type === "interface" ? `${kebab}.interface` : `${kebab}.${type}`,
      symbol: symbolName(rawName, type),
    };
  }

  switch (type) {
    case "service":
      return { folder, base: kebab, symbol: `${pascal}Service` };
    case "component":
    case "directive":
      return { folder, base: kebab, symbol: pascal };
    case "guard":
    case "resolver":
    case "pipe":
    case "store":
      return {
        folder,
        base: `${kebab}-${type}`,
        symbol: symbolName(rawName, type),
      };
    case "interface":
      return { folder, base: `${kebab}.model`, symbol: pascal };
    case "enum":
      return { folder, base: `${kebab}.enum`, symbol: pascal };
  }
}

/**
 * Maps an `add`/`remove` artifact request to the files it produces under
 * `<cwd>/<outputDir>`. The `service` type also asserts that `api-client.ts`
 * exists (it is injected), returning an error otherwise.
 */
export async function planArtifactFiles(
  type: AddType,
  rawName: string,
  cwd: string,
  outputDir: string,
  opts: AddOptions = {},
): Promise<PlanResult> {
  const naming = opts.naming ?? "suffixed";
  const prefix = opts.prefix ?? "app";
  const kebab = kebabName(rawName);
  const { folder, base, symbol } = artifactName(type, rawName, naming);
  const baseDir =
    type === "component" && opts.sharedDir ? opts.sharedDir : outputDir;
  const dir = path.join(cwd, baseDir, folder);
  const outPath = path.join(dir, `${base}.ts`);
  const single = (
    template: string,
    vars: Record<string, string>,
  ): PlanResult => ({ ok: true, files: [{ outPath, template, vars }] });

  switch (type) {
    case "service": {
      const apiClientFile = path.join(
        cwd,
        outputDir,
        coreFiles(naming).apiClient,
      );
      if (!(await fse.pathExists(apiClientFile))) {
        return {
          ok: false,
          error: `api-client.ts not found at ${path.relative(cwd, apiClientFile)}. Run \`ngx-base-cli update\` (or init) first.`,
        };
      }
      return single("feature.service.ts.tpl", {
        SERVICE_CLASS_NAME: symbol,
        API_CLIENT_IMPORT: importBetweenFiles(outPath, apiClientFile),
        ENDPOINT: kebab,
      });
    }
    case "component": {
      const selector = `${prefix}-${kebab}`;
      const inline = opts.inlineTemplate ?? false;
      const style = opts.style ?? "scss";
      const templateField = inline
        ? `  template: '<section class="${selector}"><!-- ${symbol} --></section>',\n`
        : `  templateUrl: './${base}.html',\n`;
      const styleField =
        style === "none" ? "" : `  styleUrl: './${base}.${style}',\n`;
      const files: PlannedFile[] = [
        {
          outPath,
          template: "feature.component.ts.tpl",
          vars: {
            SELECTOR: selector,
            CLASS_NAME: symbol,
            TEMPLATE_FIELD: templateField,
            STYLE_FIELD: styleField,
          },
        },
      ];
      if (!inline) {
        files.push({
          outPath: path.join(dir, `${base}.html`),
          template: "feature.component.html.tpl",
          vars: { SELECTOR: selector, CLASS_NAME: symbol },
        });
      }
      if (style !== "none") {
        files.push({
          outPath: path.join(dir, `${base}.${style}`),
          template: "feature.component.style.tpl",
          vars: {},
        });
      }
      return { ok: true, files };
    }
    case "guard":
      return single("feature.guard.ts.tpl", { FN_NAME: symbol });
    case "resolver":
      return single("feature.resolver.ts.tpl", { FN_NAME: symbol });
    case "pipe":
      return single("feature.pipe.ts.tpl", {
        CLASS_NAME: symbol,
        PIPE_NAME: camelName(rawName),
      });
    case "directive":
      return single("feature.directive.ts.tpl", {
        CLASS_NAME: symbol,
        SELECTOR: `${prefix}${pascalName(rawName)}`,
      });
    case "interface":
      return single("feature.interface.ts.tpl", { CLASS_NAME: symbol });
    case "store":
      return single("feature.store.ts.tpl", { CLASS_NAME: symbol });
    case "enum":
      return single("feature.enum.ts.tpl", { CLASS_NAME: symbol });
  }
}
