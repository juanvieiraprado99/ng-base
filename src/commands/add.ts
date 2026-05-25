import * as p from "@clack/prompts";
import fse from "fs-extra";
import path from "node:path";
import pc from "picocolors";
import { readNgxBaseConfig } from "../lib/config.js";
import { importBetweenFiles } from "../lib/import-paths.js";
import {
  ADD_TYPES,
  kebabName,
  symbolName,
  type AddType,
} from "../lib/naming.js";
import { applyTemplate } from "../lib/templates.js";

interface PlannedFile {
  outPath: string;
  template: string;
  vars: Record<string, string>;
}

async function planFiles(
  type: AddType,
  rawName: string,
  cwd: string,
  outputDir: string
): Promise<PlannedFile[] | null> {
  const kebab = kebabName(rawName);
  const className = symbolName(rawName, type);
  const base = path.join(cwd, outputDir);

  switch (type) {
    case "service": {
      const outPath = path.join(base, "services", `${kebab}.service.ts`);
      const baseServiceFile = path.join(base, "services/base.service.ts");
      if (!(await fse.pathExists(baseServiceFile))) {
        p.outro(
          pc.red(
            `base.service.ts not found at ${path.relative(cwd, baseServiceFile)}. Run init or update outputDir in .ngx-base-cli.json.`
          )
        );
        process.exitCode = 1;
        return null;
      }
      return [
        {
          outPath,
          template: "feature.service.ts.tpl",
          vars: {
            SERVICE_CLASS_NAME: className,
            BASE_SERVICE_IMPORT: importBetweenFiles(outPath, baseServiceFile),
          },
        },
      ];
    }
    case "component": {
      const dir = path.join(base, "components", kebab);
      const vars = {
        SELECTOR: `app-${kebab}`,
        FILE_BASE: kebab,
        CLASS_NAME: className,
      };
      return [
        {
          outPath: path.join(dir, `${kebab}.component.ts`),
          template: "feature.component.ts.tpl",
          vars,
        },
        {
          outPath: path.join(dir, `${kebab}.component.html`),
          template: "feature.component.html.tpl",
          vars,
        },
      ];
    }
    case "guard":
      return [
        {
          outPath: path.join(base, "guards", `${kebab}.guard.ts`),
          template: "feature.guard.ts.tpl",
          vars: { FN_NAME: className },
        },
      ];
    case "resolver":
      return [
        {
          outPath: path.join(base, "resolvers", `${kebab}.resolver.ts`),
          template: "feature.resolver.ts.tpl",
          vars: { FN_NAME: className },
        },
      ];
  }
}

export async function runAdd(
  featureName: string,
  type: AddType = "service",
  cwd: string = process.cwd()
): Promise<void> {
  p.intro(pc.inverse(` ngx-base-cli add ${type} `));

  if (!ADD_TYPES.includes(type)) {
    p.outro(pc.red(`Invalid type "${type}". Allowed: ${ADD_TYPES.join(", ")}.`));
    process.exitCode = 1;
    return;
  }

  const config = await readNgxBaseConfig(cwd);
  if (!config) {
    p.outro(
      pc.red(".ngx-base-cli.json not found. Run `ngx-base-cli init` first.")
    );
    process.exitCode = 1;
    return;
  }

  if (!kebabName(featureName)) {
    p.outro(pc.red("Invalid name."));
    process.exitCode = 1;
    return;
  }

  const files = await planFiles(type, featureName, cwd, config.outputDir);
  if (!files) return;

  for (const f of files) {
    if (await fse.pathExists(f.outPath)) {
      const overwrite = await p.confirm({
        message: `${path.relative(cwd, f.outPath)} already exists. Overwrite?`,
        initialValue: false,
      });
      if (p.isCancel(overwrite) || !overwrite) {
        p.cancel("Cancelled.");
        return;
      }
    }
  }

  for (const f of files) {
    await fse.mkdir(path.dirname(f.outPath), { recursive: true });
    const content = await applyTemplate(f.template, f.vars);
    await fse.outputFile(f.outPath, content, "utf8");
    p.log.success(pc.green(`OK: ${path.relative(cwd, f.outPath)}`));
  }

  p.outro(pc.green("ngx-base-cli add finished."));
}
