import path from "node:path";
import * as p from "@clack/prompts";
import fse from "fs-extra";
import pc from "picocolors";
import { planArtifactFiles } from "../lib/artifact-plan.js";
import { readNgxBaseConfig } from "../lib/config.js";
import { manifestKey, readManifest, writeManifest } from "../lib/manifest.js";
import { ADD_TYPES, type AddType, kebabName } from "../lib/naming.js";

export async function runRemove(
  featureName: string,
  type: AddType = "service",
  cwd: string = process.cwd(),
): Promise<void> {
  p.intro(pc.inverse(` ngx-base-cli remove ${type} `));

  if (!ADD_TYPES.includes(type)) {
    p.outro(
      pc.red(`Invalid type "${type}". Allowed: ${ADD_TYPES.join(", ")}.`),
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

  const kebab = kebabName(featureName);
  // A component's style/template flags change which files exist, so target the
  // whole feature directory rather than guessing the original flags.
  const targets =
    type === "component"
      ? [path.join(cwd, config.outputDir, "components", kebab)]
      : await resolveArtifactPaths(type, featureName, cwd, config.outputDir);

  if (targets === null) {
    p.outro(pc.red("Could not resolve target paths."));
    process.exitCode = 1;
    return;
  }

  const existing: string[] = [];
  for (const t of targets) {
    if (await fse.pathExists(t)) existing.push(t);
  }

  if (existing.length === 0) {
    p.outro(pc.yellow("Nothing to remove — no matching files on disk."));
    return;
  }

  p.note(
    existing.map((t) => pc.red(path.relative(cwd, t))).join("\n"),
    "Will delete",
  );

  const confirm = await p.confirm({
    message: `Delete ${existing.length} path(s)? This cannot be undone.`,
    initialValue: false,
  });
  if (p.isCancel(confirm) || !confirm) {
    p.cancel("Cancelled.");
    return;
  }

  const manifest = await readManifest(cwd);
  for (const t of existing) {
    await fse.remove(t);
    // Drop any manifest entry under the deleted path (file or directory).
    const prefix = manifestKey(cwd, t);
    for (const key of Object.keys(manifest.files)) {
      if (key === prefix || key.startsWith(`${prefix}/`)) {
        delete manifest.files[key];
      }
    }
    p.log.success(pc.green(`Removed: ${path.relative(cwd, t)}`));
  }
  await writeManifest(cwd, manifest);

  p.outro(pc.green("ngx-base-cli remove finished."));
}

async function resolveArtifactPaths(
  type: AddType,
  rawName: string,
  cwd: string,
  outputDir: string,
): Promise<string[] | null> {
  const plan = await planArtifactFiles(type, rawName, cwd, outputDir);
  // `service` returns an error when base.service.ts is missing; for removal the
  // path is still deterministic, so fall back to the conventional location.
  if (!plan.ok) {
    if (type === "service") {
      return [
        path.join(
          cwd,
          outputDir,
          "services",
          `${kebabName(rawName)}.service.ts`,
        ),
      ];
    }
    return null;
  }
  return plan.files.map((f) => f.outPath);
}
