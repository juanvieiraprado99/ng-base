import { createRequire } from "node:module";
import { Command } from "commander";
import pc from "picocolors";
import { runAdd } from "./commands/add.js";
import { runDoctor } from "./commands/doctor.js";
import { runGenerate } from "./commands/generate.js";
import { runInit } from "./commands/init.js";
import { runList } from "./commands/list.js";
import { MODULE_IDS } from "./lib/config.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

async function run(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(pc.red(`\nError: ${message}`));
    process.exitCode = 1;
  }
}

const cwdOption = ["-c, --cwd <dir>", "Angular project directory"] as const;

const program = new Command();

program
  .name("ng-base")
  .description(
    "Copy an HTTP core (ApiClient, cache, interceptors) and optional modules into your Angular app — the code is yours to edit",
  )
  .version(version);

program
  .command("init")
  .description(
    "Install the core: ApiClient, response cache, BASE_API_URL, environments",
  )
  .option(...cwdOption, process.cwd())
  .option("--api-url <url>", "BASE_API_URL for the environment files")
  .option("--storage <engine>", "cache storage: local | session | memory")
  .option(
    "-w, --with <modules>",
    `also add modules (comma-separated): ${MODULE_IDS.join(", ")}`,
  )
  .option("--all", "also add every module")
  .option(
    "--naming <style>",
    "file naming: auto (detect) | modern (user-card.ts) | suffixed (user-card.component.ts)",
  )
  .option(
    "--no-tsconfig",
    "do not add path aliases to tsconfig.json (relative imports)",
  )
  .option("--project <name>", "angular.json project (multi-project workspaces)")
  .option("-y, --yes", "no prompts (defaults; existing files are kept)")
  .option("--overwrite", "replace files that already exist")
  .option("--dry-run", "show what would be written")
  .option("--preset <name>", "deprecated: minimal | standard | full")
  .action((opts) =>
    run(() =>
      runInit(opts.cwd, {
        yes: opts.yes,
        dryRun: opts.dryRun,
        overwrite: opts.overwrite,
        apiUrl: opts.apiUrl,
        storage: opts.storage,
        with: opts.with,
        all: opts.all,
        preset: opts.preset,
        tsconfig: opts.tsconfig,
        project: opts.project,
        naming: opts.naming,
      }),
    ),
  );

program
  .command("add")
  .description(
    `Add modules to the project (${MODULE_IDS.join(", ")}); no names = pick from a list`,
  )
  .argument("[modules...]", "modules to add")
  .option(...cwdOption, process.cwd())
  .option("-y, --yes", "no prompts (existing files are kept)")
  .option("--overwrite", "replace files that already exist")
  .option("--dry-run", "show what would be written")
  .action((modules: string[], opts) =>
    run(() =>
      runAdd(modules, opts.cwd, {
        yes: opts.yes,
        overwrite: opts.overwrite,
        dryRun: opts.dryRun,
      }),
    ),
  );

program
  .command("list")
  .alias("ls")
  .description("List the modules and which ones are installed")
  .option(...cwdOption, process.cwd())
  .action((opts) => run(() => runList(opts.cwd)));

program
  .command("generate")
  .alias("g")
  .description("Generate a feature service that uses ApiClient")
  .argument("<type>", "what to generate: service")
  .argument("<name>", "name, e.g. user or user-profile")
  .option(...cwdOption, process.cwd())
  .option("--endpoint <path>", "API path of the resource (default /<name>)")
  .option("--overwrite", "replace the file if it exists")
  .action((type: string, name: string, opts) =>
    run(() =>
      runGenerate(type, name, opts.cwd, {
        endpoint: opts.endpoint,
        overwrite: opts.overwrite,
      }),
    ),
  );

program
  .command("doctor")
  .description("Check the setup (files, aliases, providers, interceptors)")
  .option(...cwdOption, process.cwd())
  .action((opts) => run(() => runDoctor(opts.cwd)));

program.parse();
