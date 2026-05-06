import * as p from "@clack/prompts";
import { diffLines } from "diff";
import fse from "fs-extra";
import path from "node:path";
import pc from "picocolors";
import { readNgxBaseConfig } from "../lib/config.js";
import { buildGenerationTargets } from "../lib/generate-plan.js";
import { renderGenerationTarget } from "../lib/render-target.js";

function formatDiff(oldContent: string, newContent: string): string {
  const parts = diffLines(oldContent, newContent);
  let out = "";
  for (const part of parts) {
    const lines = part.value.replace(/\n$/, "").split("\n");
    for (const line of lines) {
      if (part.added) {
        out += pc.green("+ " + line) + "\n";
      } else if (part.removed) {
        out += pc.red("- " + line) + "\n";
      } else {
        out += "  " + line + "\n";
      }
    }
  }
  return out.trimEnd();
}

export async function runUpdate(cwd: string = process.cwd()): Promise<void> {
  p.intro(pc.inverse(" ngx-base-cli update "));

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

  const targets = buildGenerationTargets(cwd, config);

  for (const t of targets) {
    const rel = path.relative(cwd, t.outPath);
    const newContent = await renderGenerationTarget(t);

    if (!(await fse.pathExists(t.outPath))) {
      await fse.mkdir(path.dirname(t.outPath), { recursive: true });
      await fse.outputFile(t.outPath, newContent, "utf8");
      p.log.success(pc.green(`Created: ${rel}`));
      continue;
    }

    const oldContent = await fse.readFile(t.outPath, "utf8");
    if (oldContent === newContent) {
      p.log.info(`No changes: ${rel}`);
      continue;
    }

    p.log.message(pc.bold(`Diff: ${rel}`));
    console.log(formatDiff(oldContent, newContent));
    console.log("");

    const apply = await p.confirm({
      message: `Overwrite ${rel}?`,
      initialValue: true,
    });
    if (p.isCancel(apply)) {
      p.cancel("Cancelled.");
      return;
    }
    if (!apply) {
      p.log.info(`Kept: ${rel}`);
      continue;
    }

    await fse.outputFile(t.outPath, newContent, "utf8");
    p.log.success(pc.green(`Updated: ${rel}`));
  }

  p.outro(pc.green("ngx-base-cli update finished."));
}
