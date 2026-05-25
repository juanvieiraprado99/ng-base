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
}

export type PlanResult =
  | { ok: true; files: PlannedFile[] }
  | { ok: false; error: string };

/**
 * Maps an `add`/`remove` artifact request to the files it produces under
 * `<cwd>/<outputDir>`. The `service` type also asserts that `base.service.ts`
 * exists (it is the superclass), returning an error otherwise.
 */
export async function planArtifactFiles(
  type: AddType,
  rawName: string,
  cwd: string,
  outputDir: string,
  opts: AddOptions = {},
): Promise<PlanResult> {
  const kebab = kebabName(rawName);
  const className = symbolName(rawName, type);
  const base = path.join(cwd, outputDir);

  switch (type) {
    case "service": {
      const outPath = path.join(base, "services", `${kebab}.service.ts`);
      const baseServiceFile = path.join(base, "services/base.service.ts");
      if (!(await fse.pathExists(baseServiceFile))) {
        return {
          ok: false,
          error: `base.service.ts not found at ${path.relative(cwd, baseServiceFile)}. Run init or update outputDir in .ngx-base-cli.json.`,
        };
      }
      return {
        ok: true,
        files: [
          {
            outPath,
            template: "feature.service.ts.tpl",
            vars: {
              SERVICE_CLASS_NAME: className,
              BASE_SERVICE_IMPORT: importBetweenFiles(outPath, baseServiceFile),
            },
          },
        ],
      };
    }
    case "component": {
      const dir = path.join(base, "components", kebab);
      const selector = `app-${kebab}`;
      const inline = opts.inlineTemplate ?? false;
      const style = opts.style ?? "scss";
      const templateField = inline
        ? `  template: '<section class="${selector}"><!-- ${className} --></section>',\n`
        : `  templateUrl: './${kebab}.component.html',\n`;
      const styleField =
        style === "none"
          ? ""
          : `  styleUrl: './${kebab}.component.${style}',\n`;
      const files: PlannedFile[] = [
        {
          outPath: path.join(dir, `${kebab}.component.ts`),
          template: "feature.component.ts.tpl",
          vars: {
            SELECTOR: selector,
            CLASS_NAME: className,
            TEMPLATE_FIELD: templateField,
            STYLE_FIELD: styleField,
          },
        },
      ];
      if (!inline) {
        files.push({
          outPath: path.join(dir, `${kebab}.component.html`),
          template: "feature.component.html.tpl",
          vars: { SELECTOR: selector, CLASS_NAME: className },
        });
      }
      if (style !== "none") {
        files.push({
          outPath: path.join(dir, `${kebab}.component.${style}`),
          template: "feature.component.style.tpl",
          vars: {},
        });
      }
      return { ok: true, files };
    }
    case "guard":
      return {
        ok: true,
        files: [
          {
            outPath: path.join(base, "guards", `${kebab}.guard.ts`),
            template: "feature.guard.ts.tpl",
            vars: { FN_NAME: className },
          },
        ],
      };
    case "resolver":
      return {
        ok: true,
        files: [
          {
            outPath: path.join(base, "resolvers", `${kebab}.resolver.ts`),
            template: "feature.resolver.ts.tpl",
            vars: { FN_NAME: className },
          },
        ],
      };
    case "pipe":
      return {
        ok: true,
        files: [
          {
            outPath: path.join(base, "pipes", `${kebab}.pipe.ts`),
            template: "feature.pipe.ts.tpl",
            vars: { CLASS_NAME: className, PIPE_NAME: camelName(rawName) },
          },
        ],
      };
    case "directive":
      return {
        ok: true,
        files: [
          {
            outPath: path.join(base, "directives", `${kebab}.directive.ts`),
            template: "feature.directive.ts.tpl",
            vars: {
              CLASS_NAME: className,
              SELECTOR: `app${pascalName(rawName)}`,
            },
          },
        ],
      };
    case "interface":
      return {
        ok: true,
        files: [
          {
            outPath: path.join(base, "interfaces", `${kebab}.interface.ts`),
            template: "feature.interface.ts.tpl",
            vars: { CLASS_NAME: className },
          },
        ],
      };
    case "store":
      return {
        ok: true,
        files: [
          {
            outPath: path.join(base, "stores", `${kebab}.store.ts`),
            template: "feature.store.ts.tpl",
            vars: { CLASS_NAME: className },
          },
        ],
      };
    case "enum":
      return {
        ok: true,
        files: [
          {
            outPath: path.join(base, "enum", `${kebab}.enum.ts`),
            template: "feature.enum.ts.tpl",
            vars: { CLASS_NAME: className },
          },
        ],
      };
  }
}
