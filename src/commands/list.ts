import path from "node:path";
import * as p from "@clack/prompts";
import fse from "fs-extra";
import pc from "picocolors";
import { readNgxBaseConfig } from "../lib/config.js";
import { buildGenerationTargets } from "../lib/generate-plan.js";
import {
  classifyTarget,
  manifestKey,
  readManifest,
  type SyncStatus,
} from "../lib/manifest.js";
import { renderGenerationTarget } from "../lib/render-target.js";

interface FileEntry {
  relPath: string;
  status: SyncStatus;
}

const STATUS_ICON: Record<SyncStatus, string> = {
  "in-sync": pc.green("OK"),
  drift: pc.yellow("!!"),
  edited: pc.magenta("~~"),
  absent: pc.red("XX"),
};

const STATUS_LABEL: Record<SyncStatus, string> = {
  "in-sync": pc.green("present, in sync"),
  drift: pc.yellow("present, out of date (update available)"),
  edited: pc.magenta("present, locally edited"),
  absent: pc.red("absent"),
};

export async function runList(
  cwd: string = process.cwd(),
  check = false,
): Promise<void> {
  p.intro(pc.inverse(" ngx-base-cli list "));

  const config = await readNgxBaseConfig(cwd);
  if (!config) {
    p.outro(
      pc.red(".ngx-base-cli.json not found. Run `ngx-base-cli init` first."),
    );
    process.exitCode = 1;
    return;
  }

  const targets = buildGenerationTargets(cwd, config);
  const manifest = await readManifest(cwd);
  const entries: FileEntry[] = [];

  for (const t of targets) {
    const relPath = path.relative(cwd, t.outPath).replace(/\\/g, "/");
    const key = manifestKey(cwd, t.outPath);

    if (!(await fse.pathExists(t.outPath))) {
      entries.push({ relPath, status: "absent" });
      continue;
    }

    if (t.dirOnly) {
      entries.push({ relPath, status: "in-sync" });
      continue;
    }

    try {
      const expected = await renderGenerationTarget(t);
      const disk = await fse.readFile(t.outPath, "utf8");
      const status = classifyTarget(disk, expected, manifest.files[key]?.hash);
      entries.push({ relPath, status });
    } catch {
      entries.push({ relPath, status: "absent" });
    }
  }

  const maxLen = Math.max(...entries.map((e) => e.relPath.length));

  const body = entries
    .map((entry) => {
      const padded = entry.relPath.padEnd(maxLen);
      return `${STATUS_ICON[entry.status]}  ${pc.dim(padded)}  ${STATUS_LABEL[entry.status]}`;
    })
    .join("\n");
  p.note(body, "Sync status");

  const total = entries.length;
  const count = (s: SyncStatus) => entries.filter((e) => e.status === s).length;

  const parts: string[] = [];
  if (count("in-sync")) parts.push(pc.green(`${count("in-sync")} in sync`));
  if (count("drift")) parts.push(pc.yellow(`${count("drift")} out of date`));
  if (count("edited"))
    parts.push(pc.magenta(`${count("edited")} locally edited`));
  if (count("absent")) parts.push(pc.red(`${count("absent")} absent`));

  // `list` is informational by default; `--check` turns it into a CI gate.
  if (check && (count("drift") > 0 || count("absent") > 0)) {
    process.exitCode = 1;
  }

  p.outro(`${total} files — ${parts.join(pc.dim(" · "))}`);
}
