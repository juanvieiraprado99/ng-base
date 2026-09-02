import { createRequire } from "node:module";
import { Command } from "commander";
import pc from "picocolors";
import { runAdd } from "./commands/add.js";
import { runDoctor } from "./commands/doctor.js";
import { runInit } from "./commands/init.js";
import { runList } from "./commands/list.js";
import { runRemove } from "./commands/remove.js";
import { runUpdate } from "./commands/update.js";
import type { ComponentStyle } from "./lib/artifact-plan.js";
import { ADD_TYPES, type AddType } from "./lib/naming.js";
import type { PresetName } from "./lib/presets.js";

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

const program = new Command();

program
  .name("ngx-base-cli")
  .description(
    "CLI to scaffold BaseService, CacheService, and HTTP artifacts in Angular projects",
  )
  .version(version);

program
  .command("init")
  .description(
    "Generate base/cache services, models, and optional interceptors in the project",
  )
  .option("-c, --cwd <dir>", "Angular project directory", process.cwd())
  .option("-y, --yes", "Skip interactive prompts — select a preset instead")
  .option("--dry-run", "Show what would be generated without writing files")
  .option("--skip-tests", "Do not generate .spec.ts files for added artifacts")
  .option(
    "--preset <name>",
    "Use a preset without prompting: minimal | standard | full",
  )
  .action(
    (opts: {
      cwd?: string;
      yes?: boolean;
      dryRun?: boolean;
      skipTests?: boolean;
      preset?: string;
    }) =>
      run(() =>
        runInit(opts.cwd ?? process.cwd(), {
          yes: opts.yes ?? false,
          dryRun: opts.dryRun ?? false,
          skipTests: opts.skipTests ?? false,
          preset: opts.preset as PresetName | undefined,
        }),
      ),
  );

program
  .command("add")
  .description(
    `Generate a feature artifact (${ADD_TYPES.join("|")}) under <outputDir>/`,
  )
  .argument("<name>", "feature name (e.g. user, user-profile)")
  .option(
    "-t, --type <type>",
    `artifact type: ${ADD_TYPES.join(" | ")}`,
    "service",
  )
  .option(
    "--inline-template",
    "(component) inline template instead of a separate .html file",
  )
  .option("--style <ext>", "(component) stylesheet: scss | css | none", "scss")
  .option("--skip-tests", "Do not generate the companion .spec.ts file")
  .option("-c, --cwd <dir>", "Angular project directory", process.cwd())
  .action(
    (
      name: string,
      opts: {
        cwd?: string;
        type?: string;
        inlineTemplate?: boolean;
        style?: string;
        skipTests?: boolean;
      },
    ) =>
      run(() =>
        runAdd(
          name,
          (opts.type ?? "service") as AddType,
          opts.cwd ?? process.cwd(),
          {
            inlineTemplate: opts.inlineTemplate ?? false,
            style: (opts.style ?? "scss") as ComponentStyle,
            skipTests: opts.skipTests ?? false,
          },
        ),
      ),
  );

program
  .command("remove")
  .alias("rm")
  .description(
    `Delete a generated artifact (${ADD_TYPES.join("|")}) and its manifest entries`,
  )
  .argument("<name>", "feature name (e.g. user, user-profile)")
  .option(
    "-t, --type <type>",
    `artifact type: ${ADD_TYPES.join(" | ")}`,
    "service",
  )
  .option("-c, --cwd <dir>", "Angular project directory", process.cwd())
  .action((name: string, opts: { cwd?: string; type?: string }) =>
    run(() =>
      runRemove(
        name,
        (opts.type ?? "service") as AddType,
        opts.cwd ?? process.cwd(),
      ),
    ),
  );

program
  .command("update")
  .description(
    "Regenerate init-generated files from .ngx-base-cli.json (shows diff)",
  )
  .option("-c, --cwd <dir>", "Angular project directory", process.cwd())
  .option("-y, --yes", "Apply all updates without prompts")
  .option("-f, --force", "Also overwrite files with local edits")
  .action((opts: { cwd?: string; yes?: boolean; force?: boolean }) =>
    run(() =>
      runUpdate(
        opts.cwd ?? process.cwd(),
        opts.yes ?? false,
        opts.force ?? false,
      ),
    ),
  );

program
  .command("list")
  .description(
    "Show sync status of each generated file (in-sync/out-of-date/locally-edited/absent)",
  )
  .option("-c, --cwd <dir>", "Angular project directory", process.cwd())
  .option(
    "--check",
    "Exit with code 1 when files are absent or out of date (for CI)",
  )
  .action((opts: { cwd?: string; check?: boolean }) =>
    run(() => runList(opts.cwd ?? process.cwd(), opts.check ?? false)),
  );

program
  .command("doctor")
  .description(
    "Validate post-init setup (base files, aliases, providers, auth token)",
  )
  .option("-c, --cwd <dir>", "Angular project directory", process.cwd())
  .action((opts: { cwd?: string }) =>
    run(() => runDoctor(opts.cwd ?? process.cwd())),
  );

program.parse();
