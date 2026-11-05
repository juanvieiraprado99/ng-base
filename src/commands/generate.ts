import path from "node:path";
import * as p from "@clack/prompts";
import fse from "fs-extra";
import pc from "picocolors";
import { readNgBaseConfig } from "../lib/config.js";
import { kebabName } from "../lib/naming.js";
import { coreFiles } from "../lib/naming-style.js";
import { planService } from "../lib/service-plan.js";
import { applyTemplate } from "../lib/templates.js";

export const GENERATE_TYPES = ["service"] as const;

export interface GenerateOptions {
  /** API path of the resource (default `/<name>`). */
  endpoint?: string;
  /** Replace an existing file without asking. */
  overwrite?: boolean;
}

/** `ng-base generate service <name>` — a feature service built on ApiClient. */
export async function runGenerate(
  type: string,
  name: string,
  cwd: string = process.cwd(),
  opts: GenerateOptions = {},
): Promise<void> {
  p.intro(pc.inverse(` ng-base generate ${type} `));

  if (!(GENERATE_TYPES as readonly string[]).includes(type)) {
    p.outro(
      pc.red(
        `Unknown type "${type}". ng-base generates: ${GENERATE_TYPES.join(", ")} — use \`ng generate\` for components, pipes, etc.`,
      ),
    );
    process.exitCode = 1;
    return;
  }
  if (!kebabName(name)) {
    p.outro(pc.red("Invalid name."));
    process.exitCode = 1;
    return;
  }

  const config = await readNgBaseConfig(cwd);
  if (!config) {
    p.outro(pc.red(".ng-base.json not found. Run `ng-base init` first."));
    process.exitCode = 1;
    return;
  }
  const apiClient = path.join(
    cwd,
    config.outputDir,
    coreFiles(config.naming).apiClient,
  );
  if (!(await fse.pathExists(apiClient))) {
    p.outro(
      pc.red(
        `ApiClient not found at ${path.relative(cwd, apiClient)}. Run \`ng-base init\` first.`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const plan = planService(name, cwd, config.outputDir, {
    naming: config.naming,
    endpoint: opts.endpoint,
  });
  const relPath = path.relative(cwd, plan.outPath).replace(/\\/g, "/");
  if ((await fse.pathExists(plan.outPath)) && !opts.overwrite) {
    const ok = await p.confirm({
      message: `${relPath} already exists. Overwrite?`,
      initialValue: false,
    });
    if (p.isCancel(ok) || !ok) {
      p.cancel("Kept the existing file.");
      return;
    }
  }

  await fse.outputFile(
    plan.outPath,
    await applyTemplate("feature.service.ts.tpl", plan.vars),
    "utf8",
  );
  p.log.success(pc.green(`OK: ${relPath}`));
  p.outro(pc.green(`${plan.className} created.`));
}
