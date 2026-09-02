import path from "node:path";
import * as p from "@clack/prompts";
import fse from "fs-extra";
import pc from "picocolors";
import { resolveCapabilities } from "../lib/angular-version.js";
import {
  type AddOptions,
  COMPONENT_STYLES,
  planArtifactFiles,
} from "../lib/artifact-plan.js";
import { readNgxBaseConfig } from "../lib/config.js";
import {
  manifestKey,
  readManifest,
  sha256,
  writeManifest,
} from "../lib/manifest.js";
import { ADD_TYPES, type AddType, kebabName } from "../lib/naming.js";
import { applyTemplate } from "../lib/templates.js";
import { detectSpecStyle } from "../lib/test-runner.js";

export async function runAdd(
  featureName: string,
  type: AddType = "service",
  cwd: string = process.cwd(),
  opts: AddOptions = {},
): Promise<void> {
  p.intro(pc.inverse(` ngx-base-cli add ${type} `));

  if (!ADD_TYPES.includes(type)) {
    p.outro(
      pc.red(`Invalid type "${type}". Allowed: ${ADD_TYPES.join(", ")}.`),
    );
    process.exitCode = 1;
    return;
  }

  if (opts.style && !COMPONENT_STYLES.includes(opts.style)) {
    p.outro(
      pc.red(
        `Invalid style "${opts.style}". Allowed: ${COMPONENT_STYLES.join(", ")}.`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const config = await readNgxBaseConfig(cwd);
  if (!config) {
    p.outro(
      pc.red(".ngx-base-cli.json not found. Run `ngx-base-cli init` first."),
    );
    process.exitCode = 1;
    return;
  }

  if (!kebabName(featureName)) {
    p.outro(pc.red("Invalid name."));
    process.exitCode = 1;
    return;
  }

  // Everything version-dependent comes from the config the project was
  // initialised with, falling back to the Angular version on disk.
  const caps = await resolveCapabilities(cwd, config.angularTarget);
  const planOptions: AddOptions = {
    ...opts,
    fileNaming: config.fileNaming,
    generateSpecs: config.generateSpecs && !opts.skipTests,
    specStyle: await detectSpecStyle(cwd, caps),
    onPushIsDefault: caps.onPushIsDefault,
    serviceDecorator: caps.serviceDecorator,
    signalFormsStable: caps.signalFormsStable,
  };

  const plan = await planArtifactFiles(
    type,
    featureName,
    cwd,
    config.outputDir,
    planOptions,
  );
  if (!plan.ok) {
    p.outro(pc.red(plan.error));
    process.exitCode = 1;
    return;
  }
  const files = plan.files;

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

  const manifest = await readManifest(cwd);
  for (const f of files) {
    await fse.mkdir(path.dirname(f.outPath), { recursive: true });
    const content = await applyTemplate(f.template, f.vars);
    await fse.outputFile(f.outPath, content, "utf8");
    manifest.files[manifestKey(cwd, f.outPath)] = {
      hash: sha256(content),
      template: f.template,
    };
    p.log.success(pc.green(`OK: ${path.relative(cwd, f.outPath)}`));
  }
  await writeManifest(cwd, manifest);

  p.outro(pc.green("ngx-base-cli add finished."));
}
