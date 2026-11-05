import path from "node:path";
import * as p from "@clack/prompts";
import fse from "fs-extra";
import pc from "picocolors";
import { artifactName, planArtifactFiles } from "../lib/artifact-plan.js";
import { type NgxBaseCliConfig, readNgxBaseConfig } from "../lib/config.js";
import { manifestKey, readManifest, writeManifest } from "../lib/manifest.js";
import { ADD_TYPES, type AddType, kebabName } from "../lib/naming.js";
import { resolveWorkspace } from "../lib/workspace.js";

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
  const ws = await resolveWorkspace(cwd, config.project);
  // A component's style/template flags change which files exist, so target the
  // whole feature directory rather than guessing the original flags. Components
  // live in shared/components (older versions used core/components).
  const targets =
    type === "component"
      ? [
          path.join(cwd, ws.appDir, "shared", "components", kebab),
          path.join(cwd, config.outputDir, "components", kebab),
        ]
      : await resolveArtifactPaths(type, featureName, cwd, config);

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
  config: NgxBaseCliConfig,
): Promise<string[] | null> {
  const plan = await planArtifactFiles(type, rawName, cwd, config.outputDir, {
    naming: config.naming,
  });
  // `service` returns an error when api-client.ts is missing; for removal the
  // path is still deterministic, so fall back to the conventional location.
  if (!plan.ok) {
    if (type === "service") {
      const { folder, base } = artifactName(type, rawName, config.naming);
      return [path.join(cwd, config.outputDir, folder, `${base}.ts`)];
    }
    return null;
  }
  return plan.files.map((f) => f.outPath);
}
