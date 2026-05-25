import { Command } from "commander";
import { createRequire } from "node:module";
import { runAdd } from "./commands/add.js";
import { runInit } from "./commands/init.js";
import { runList } from "./commands/list.js";
import { runUpdate } from "./commands/update.js";
import type { AddType } from "./lib/naming.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const program = new Command();

program
  .name("ngx-base-cli")
  .description(
    "CLI to scaffold BaseService, CacheService, and HTTP artifacts in Angular projects"
  )
  .version(version);

program
  .command("init")
  .description(
    "Generate base/cache services, models, and optional interceptors in the project"
  )
  .option("-c, --cwd <dir>", "Angular project directory", process.cwd())
  .option("-y, --yes", "Skip interactive prompts — select a preset instead")
  .option("--dry-run", "Show what would be generated without writing files")
  .action(async (opts: { cwd?: string; yes?: boolean; dryRun?: boolean }) => {
    await runInit(
      opts.cwd ?? process.cwd(),
      opts.yes ?? false,
      opts.dryRun ?? false
    );
  });

program
  .command("add")
  .description(
    "Generate a feature artifact (service|component|guard|resolver) under <outputDir>/"
  )
  .argument("<name>", "feature name (e.g. user, user-profile)")
  .option(
    "-t, --type <type>",
    "artifact type: service | component | guard | resolver",
    "service"
  )
  .option("-c, --cwd <dir>", "Angular project directory", process.cwd())
  .action(async (name: string, opts: { cwd?: string; type?: string }) => {
    await runAdd(
      name,
      (opts.type ?? "service") as AddType,
      opts.cwd ?? process.cwd()
    );
  });

program
  .command("update")
  .description(
    "Regenerate init-generated files from .ngx-base-cli.json (shows diff)"
  )
  .option("-c, --cwd <dir>", "Angular project directory", process.cwd())
  .option("-y, --yes", "Apply all updates without prompts")
  .option("-f, --force", "Also overwrite files with local edits")
  .action(async (opts: { cwd?: string; yes?: boolean; force?: boolean }) => {
    await runUpdate(
      opts.cwd ?? process.cwd(),
      opts.yes ?? false,
      opts.force ?? false
    );
  });

program
  .command("list")
  .description(
    "Show sync status of each generated file (in-sync/out-of-date/locally-edited/absent)"
  )
  .option("-c, --cwd <dir>", "Angular project directory", process.cwd())
  .action(async (opts: { cwd?: string }) => {
    await runList(opts.cwd ?? process.cwd());
  });

program.parse();
