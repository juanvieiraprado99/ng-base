import * as p from "@clack/prompts";
import fse from "fs-extra";
import path from "node:path";
import pc from "picocolors";
import { readNgxBaseConfig } from "../lib/config.js";
import { buildGenerationTargets } from "../lib/generate-plan.js";
import { renderGenerationTarget } from "../lib/render-target.js";

type FileStatus = "present" | "diverge" | "absent";

interface FileEntry {
  relPath: string;
  status: FileStatus;
}

const STATUS_ICON: Record<FileStatus, string> = {
  present: pc.green("✅"),
  diverge: pc.yellow("⚠️ "),
  absent: pc.red("❌"),
};

const STATUS_LABEL: Record<FileStatus, string> = {
  present: pc.green("present, in sync"),
  diverge: pc.yellow("present, diverges from template"),
  absent: pc.red("absent"),
};

export async function runList(cwd: string = process.cwd()): Promise<void> {
  p.intro(pc.inverse(" ngx-base-cli list "));

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
  const entries: FileEntry[] = [];

  for (const t of targets) {
    const relPath = path.relative(cwd, t.outPath).replace(/\\/g, "/");
    const exists = await fse.pathExists(t.outPath);

    if (!exists) {
      entries.push({ relPath, status: "absent" });
      continue;
    }

    if (t.rawContent !== undefined) {
      const disk = await fse.readFile(t.outPath, "utf8");
      const status = disk === t.rawContent ? "present" : "diverge";
      entries.push({ relPath, status });
      continue;
    }

    try {
      const expected = await renderGenerationTarget(t);
      const disk = await fse.readFile(t.outPath, "utf8");
      const status = disk === expected ? "present" : "diverge";
      entries.push({ relPath, status });
    } catch {
      entries.push({ relPath, status: "absent" });
    }
  }

  const maxLen = Math.max(...entries.map((e) => e.relPath.length));

  console.log("");
  for (const entry of entries) {
    const padded = entry.relPath.padEnd(maxLen);
    console.log(
      `  ${STATUS_ICON[entry.status]}  ${pc.dim(padded)}  ${STATUS_LABEL[entry.status]}`
    );
  }
  console.log("");

  const total = entries.length;
  const present = entries.filter((e) => e.status === "present").length;
  const diverge = entries.filter((e) => e.status === "diverge").length;
  const absent = entries.filter((e) => e.status === "absent").length;

  const parts: string[] = [];
  if (present) parts.push(pc.green(`${present} in sync`));
  if (diverge) parts.push(pc.yellow(`${diverge} diverge`));
  if (absent) parts.push(pc.red(`${absent} absent`));

  p.outro(`${total} files — ${parts.join(pc.dim(" · "))}`);
}
