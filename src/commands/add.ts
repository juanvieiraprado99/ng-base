import * as p from "@clack/prompts";
import fse from "fs-extra";
import path from "node:path";
import pc from "picocolors";
import { readNgxBaseConfig } from "../lib/config.js";
import { importBetweenFiles } from "../lib/import-paths.js";
import { applyTemplate } from "../lib/templates.js";

function toFeatureServiceClassName(raw: string): string {
  const s = raw.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  const parts = s.split(/[-_/]/).filter(Boolean);
  const pascal = parts
    .map(
      (part) =>
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    )
    .join("");
  return `${pascal || "Feature"}Service`;
}

function kebabFeatureDir(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function runAdd(
  featureName: string,
  cwd: string = process.cwd()
): Promise<void> {
  p.intro(pc.inverse(" ngx-base-cli add "));

  const config = await readNgxBaseConfig(cwd);
  if (!config) {
    p.outro(
      pc.red(
        ".ngx-base-cli.json not found. Run `ngx-base-cli init` first."
      )
    );
    process.exitCode = 1;
    return;
  }

  const dirName = kebabFeatureDir(featureName);
  if (!dirName) {
    p.outro(pc.red("Invalid name."));
    process.exitCode = 1;
    return;
  }

  const serviceClass = toFeatureServiceClassName(featureName);
  const servicesDir = path.join(cwd, config.outputDir, "services");
  const outPath = path.join(servicesDir, `${dirName}.service.ts`);
  const baseServiceFile = path.join(
    cwd,
    config.outputDir,
    "services/base.service.ts"
  );

  if (!(await fse.pathExists(baseServiceFile))) {
    p.outro(
      pc.red(
        `base.service.ts not found at ${path.relative(cwd, baseServiceFile)}. Run init or update outputDir in .ngx-base-cli.json.`
      )
    );
    process.exitCode = 1;
    return;
  }

  const baseServiceImport = importBetweenFiles(outPath, baseServiceFile);

  if (await fse.pathExists(outPath)) {
    const overwrite = await p.confirm({
      message: `${path.relative(cwd, outPath)} already exists. Overwrite?`,
      initialValue: false,
    });
    if (p.isCancel(overwrite) || !overwrite) {
      p.cancel("Cancelled.");
      return;
    }
  }

  await fse.mkdir(servicesDir, { recursive: true });

  const content = await applyTemplate("feature.service.ts.tpl", {
    SERVICE_CLASS_NAME: serviceClass,
    BASE_SERVICE_IMPORT: baseServiceImport,
  });

  await fse.outputFile(outPath, content, "utf8");
  p.log.success(pc.green(`OK: ${path.relative(cwd, outPath)}`));

  p.outro(pc.green("ngx-base-cli add finished."));
}
