import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  isModuleId,
  MODULE_IDS,
  type ModuleId,
  readNgBaseConfig,
  writeNgBaseConfig,
} from "../lib/config.js";
import { installModules, printNextSteps } from "../lib/install.js";
import { getModule, sortIds } from "../lib/modules.js";
import { resolveWorkspace } from "../lib/workspace.js";

export interface AddCommandOptions {
  yes?: boolean;
  /** Replace files that already exist (and re-install listed modules). */
  overwrite?: boolean;
  dryRun?: boolean;
}

/** `ng-base add [modules...]` — copies modules into the project. */
export async function runAdd(
  names: string[],
  cwd: string = process.cwd(),
  opts: AddCommandOptions = {},
): Promise<void> {
  p.intro(pc.inverse(" ng-base add "));

  const config = await readNgBaseConfig(cwd);
  if (!config) {
    p.outro(pc.red(".ng-base.json not found. Run `ng-base init` first."));
    process.exitCode = 1;
    return;
  }

  const unknown = names.filter((n) => !isModuleId(n));
  if (unknown.length > 0) {
    p.outro(
      pc.red(
        `Unknown module(s): ${unknown.join(", ")}. Available: ${MODULE_IDS.join(", ")} (see \`ng-base list\`).`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  let requested = names as ModuleId[];
  if (requested.length === 0) {
    const available = MODULE_IDS.filter((id) => !config.modules.includes(id));
    if (available.length === 0) {
      p.outro(pc.green("Every module is already installed."));
      return;
    }
    if (opts.yes) {
      p.outro(pc.red("Name the module(s) to add, e.g. `ng-base add auth`."));
      process.exitCode = 1;
      return;
    }
    const picked = await p.multiselect<ModuleId>({
      message: "Which modules? (space to toggle, enter to install)",
      options: available.map((id) => ({
        value: id,
        label: id,
        hint: getModule(id).description,
      })),
      required: true,
    });
    if (p.isCancel(picked)) {
      p.cancel("Cancelled.");
      return;
    }
    requested = picked;
  }

  const already = requested.filter((id) => config.modules.includes(id));
  const ids = opts.overwrite
    ? sortIds(requested)
    : sortIds(requested.filter((id) => !config.modules.includes(id)));
  if (already.length > 0 && !opts.overwrite) {
    p.log.info(
      pc.dim(
        `Already installed: ${already.join(", ")} (use --overwrite to copy again).`,
      ),
    );
  }
  if (ids.length === 0) {
    p.outro(pc.green("Nothing to add."));
    return;
  }

  const ws = await resolveWorkspace(cwd, config.project);
  const result = await installModules(cwd, config, ws, ids, opts);
  if (!result) return;
  if (opts.dryRun) {
    p.outro(pc.green("Dry run complete — nothing was written."));
    return;
  }

  await writeNgBaseConfig(cwd, result.config);
  await printNextSteps(cwd, config, ws, ids);
  p.outro(pc.green(`Added: ${ids.join(", ")}.`));
}
