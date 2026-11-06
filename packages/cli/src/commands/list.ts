import * as p from "@clack/prompts";
import pc from "picocolors";
import { readNgBaseConfig } from "../lib/config.js";
import { MODULES } from "../lib/modules.js";

/** `ngx-base-cli list` — available modules and which ones the project has. */
export async function runList(cwd: string = process.cwd()): Promise<void> {
  p.intro(pc.inverse(" ngx-base-cli list "));
  const config = await readNgBaseConfig(cwd);
  const installed = new Set<string>(config ? ["core", ...config.modules] : []);

  const width = Math.max(...MODULES.map((m) => m.id.length));
  const body = MODULES.map((m) => {
    const mark = installed.has(m.id) ? pc.green("✔") : pc.dim("·");
    const how = m.id === "core" ? "init" : `add ${m.id}`;
    return `${mark}  ${m.id.padEnd(width)}  ${m.description}\n   ${" ".repeat(width)}  ${pc.dim(`ngx-base-cli ${how}`)}`;
  }).join("\n");
  p.note(body, config ? "Modules (✔ installed)" : "Modules");
  p.outro(
    config
      ? pc.green(`${installed.size} of ${MODULES.length} installed.`)
      : pc.dim("Not initialized yet — start with `ngx-base-cli init`."),
  );
}
