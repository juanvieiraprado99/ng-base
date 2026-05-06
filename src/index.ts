import { Command } from "commander";
import { runAdd } from "./commands/add.js";
import { runInit } from "./commands/init.js";
import { runUpdate } from "./commands/update.js";

const program = new Command();

program
  .name("ngx-base-cli")
  .description(
    "CLI to scaffold BaseService, CacheService, and HTTP artifacts in Angular projects"
  )
  .version("0.1.0-alpha.0");

program
  .command("init")
  .description(
    "Generate base/cache services, models, and optional interceptors in the project"
  )
  .option("-c, --cwd <dir>", "Angular project directory", process.cwd())
  .action(async (opts: { cwd?: string }) => {
    await runInit(opts.cwd ?? process.cwd());
  });

program
  .command("add")
  .description(
    "Generate a feature service extending BaseService under src/app/features/<name>/"
  )
  .argument("<name>", "feature name (e.g. user, user-profile)")
  .option("-c, --cwd <dir>", "Angular project directory", process.cwd())
  .action(async (name: string, opts: { cwd?: string }) => {
    await runAdd(name, opts.cwd ?? process.cwd());
  });

program
  .command("update")
  .description(
    "Regenerate init-generated files from .ngx-base-cli.json (shows diff)"
  )
  .option("-c, --cwd <dir>", "Angular project directory", process.cwd())
  .action(async (opts: { cwd?: string }) => {
    await runUpdate(opts.cwd ?? process.cwd());
  });

program.parse();
