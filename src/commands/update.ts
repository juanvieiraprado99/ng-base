import * as p from "@clack/prompts";
import { diffLines } from "diff";
import fse from "fs-extra";
import path from "node:path";
import pc from "picocolors";
import { readNgxBaseConfig } from "../lib/config.js";
import {
  buildGenerationTargets,
  type GenerationTarget,
} from "../lib/generate-plan.js";
import { patchAngularJsonFileReplacements } from "../lib/patch-angular-json.js";
import { patchAppConfigForHttp } from "../lib/patch-app-config.js";
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

type PendingChange = {
  target: GenerationTarget;
  rel: string;
  oldContent: string;
  newContent: string;
};

export async function runUpdate(
  cwd: string = process.cwd(),
  yes = false
): Promise<void> {
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
  const pending: PendingChange[] = [];

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

    if (yes) {
      await fse.outputFile(t.outPath, newContent, "utf8");
      p.log.success(pc.green(`Updated: ${rel}`));
      continue;
    }

    pending.push({ target: t, rel, oldContent, newContent });
  }

  if (pending.length > 0) {
    for (const { rel, oldContent, newContent } of pending) {
      p.log.message(pc.bold(`Diff: ${rel}`));
      console.log(formatDiff(oldContent, newContent));
      console.log("");
    }

    const applyAll = await p.confirm({
      message: `Overwrite all ${pending.length} modified file(s)?`,
      initialValue: true,
    });
    if (p.isCancel(applyAll)) {
      p.cancel("Cancelled.");
      return;
    }
    if (!applyAll) {
      for (const { rel } of pending) {
        p.log.info(`Kept: ${rel}`);
      }
    } else {
      for (const { target: t, rel, newContent } of pending) {
        await fse.outputFile(t.outPath, newContent, "utf8");
        p.log.success(pc.green(`Updated: ${rel}`));
      }
    }
  }

  if (await fse.pathExists(path.join(cwd, "angular.json"))) {
    await patchAngularJsonFileReplacements(cwd);
  }
  const appCfgResult = await patchAppConfigForHttp(cwd, config);
  if (appCfgResult.withInterceptorsAlreadyPresent) {
    p.log.warn(
      pc.yellow(
        "app.config.ts already contains withInterceptors(...). ngx-base-cli will not merge interceptor lists automatically; add the generated interceptors to your withInterceptors([...]) manually."
      )
    );
  }

  p.outro(pc.green("ngx-base-cli update finished."));
}
