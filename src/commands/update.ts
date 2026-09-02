import path from "node:path";
import * as p from "@clack/prompts";
import fse from "fs-extra";
import pc from "picocolors";
import { readNgxBaseConfig } from "../lib/config.js";
import { formatDiff } from "../lib/diff.js";
import {
  buildGenerationTargets,
  type GenerationTarget,
} from "../lib/generate-plan.js";
import {
  classifyTarget,
  type Manifest,
  manifestKey,
  readManifest,
  sha256,
  writeManifest,
} from "../lib/manifest.js";
import { patchAngularJsonFileReplacements } from "../lib/patch-angular-json.js";
import { patchAppConfigForHttp } from "../lib/patch-app-config.js";
import { renderGenerationTarget } from "../lib/render-target.js";

type PendingChange = {
  target: GenerationTarget;
  rel: string;
  key: string;
  oldContent: string;
  newContent: string;
  edited: boolean;
};

export async function runUpdate(
  cwd: string = process.cwd(),
  yes = false,
  force = false,
): Promise<void> {
  p.intro(pc.inverse(" ngx-base-cli update "));

  const config = await readNgxBaseConfig(cwd);
  if (!config) {
    p.outro(
      pc.red(".ngx-base-cli.json not found. Run `ngx-base-cli init` first."),
    );
    process.exitCode = 1;
    return;
  }

  const targets = buildGenerationTargets(cwd, config);
  const oldManifest = await readManifest(cwd);
  const newManifest: Manifest = { version: 1, files: {} };
  const pending: PendingChange[] = [];
  let wroteAnything = false;

  for (const t of targets) {
    const rel = path.relative(cwd, t.outPath);
    const key = manifestKey(cwd, t.outPath);

    if (t.dirOnly) {
      if (!(await fse.pathExists(t.outPath))) {
        await fse.ensureDir(t.outPath);
        wroteAnything = true;
        p.log.success(pc.green(`Created: ${rel}`));
      } else {
        p.log.info(`No changes: ${rel}`);
      }
      continue;
    }

    const newContent = await renderGenerationTarget(t, cwd);

    if (!(await fse.pathExists(t.outPath))) {
      await fse.mkdir(path.dirname(t.outPath), { recursive: true });
      await fse.outputFile(t.outPath, newContent, "utf8");
      newManifest.files[key] = {
        hash: sha256(newContent),
        template: t.template,
      };
      wroteAnything = true;
      p.log.success(pc.green(`Created: ${rel}`));
      continue;
    }

    const oldContent = await fse.readFile(t.outPath, "utf8");
    const status = classifyTarget(
      oldContent,
      newContent,
      oldManifest.files[key]?.hash,
    );

    if (status === "in-sync") {
      p.log.info(`No changes: ${rel}`);
      newManifest.files[key] = {
        hash: sha256(newContent),
        template: t.template,
      };
      continue;
    }

    pending.push({
      target: t,
      rel,
      key,
      oldContent,
      newContent,
      edited: status === "edited",
    });
  }

  const editedCount = pending.filter((c) => c.edited).length;

  const applied = new Set<string>();
  if (pending.length > 0) {
    for (const { rel, oldContent, newContent, edited } of pending) {
      const label = edited
        ? `${pc.bold(`Diff: ${rel}`)} ${pc.yellow("(locally edited)")}`
        : pc.bold(`Diff: ${rel}`);
      p.log.message(label);
      console.log(formatDiff(oldContent, newContent));
      console.log("");
    }

    if (editedCount > 0 && !force) {
      p.log.warn(
        pc.yellow(
          `${editedCount} file(s) have local edits and will be kept. Re-run with --force to overwrite them.`,
        ),
      );
    }

    const candidates = force ? pending : pending.filter((c) => !c.edited);

    let doApply = yes;
    if (!yes && candidates.length > 0) {
      const answer = await p.confirm({
        message: `Overwrite ${candidates.length} file(s)?`,
        initialValue: true,
      });
      if (p.isCancel(answer)) {
        p.cancel("Cancelled.");
        return;
      }
      doApply = answer;
    }

    for (const c of pending) {
      const willWrite = doApply && (force || !c.edited);
      if (willWrite) {
        await fse.outputFile(c.target.outPath, c.newContent, "utf8");
        applied.add(c.key);
        wroteAnything = true;
        p.log.success(pc.green(`Updated: ${c.rel}`));
      } else {
        p.log.info(`Kept: ${c.rel}`);
      }
    }
  }

  // Refresh manifest hashes: applied files get the new hash; kept files retain
  // their previous record so they keep classifying as locally-edited.
  for (const c of pending) {
    const previous = oldManifest.files[c.key];
    if (applied.has(c.key)) {
      newManifest.files[c.key] = {
        hash: sha256(c.newContent),
        template: c.target.template,
      };
    } else if (previous) {
      newManifest.files[c.key] = previous;
    }
  }
  await writeManifest(cwd, newManifest);

  // Only touch angular.json / app.config when we actually wrote files, or when
  // everything was already in sync (idempotent maintenance). If the user
  // declined to overwrite pending changes, leave their project untouched.
  if (wroteAnything || pending.length === 0) {
    if (await fse.pathExists(path.join(cwd, "angular.json"))) {
      await patchAngularJsonFileReplacements(cwd, config.environmentStyle);
    }
    await patchAppConfigForHttp(cwd, config);
  }

  p.outro(pc.green("ngx-base-cli update finished."));
}
