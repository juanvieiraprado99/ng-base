import path from "node:path";
import * as p from "@clack/prompts";
import fse from "fs-extra";
import pc from "picocolors";
import { sha256 } from "../lib/manifest.js";
import {
  builtInTemplatesDir,
  cliVersion,
  listBuiltInTemplates,
  overrideTemplatesDir,
  readEjectRegistry,
  resolveTemplateName,
  writeEjectRegistry,
} from "../lib/template-registry.js";

export interface EjectOptions {
  force?: boolean;
  list?: boolean;
  diff?: string;
  revert?: boolean;
  yes?: boolean;
}

export async function runEject(
  names: string[],
  cwd: string = process.cwd(),
  opts: EjectOptions = {},
): Promise<void> {
  p.intro(pc.inverse(" ngx-base-cli eject "));

  const builtIn = await listBuiltInTemplates();

  // Resolve every name up front: one bad argument should not leave the project
  // half-ejected.
  const resolved: string[] = [];
  for (const input of names) {
    try {
      resolved.push(resolveTemplateName(input, builtIn));
    } catch (err) {
      p.outro(pc.red(err instanceof Error ? err.message : String(err)));
      process.exitCode = 1;
      return;
    }
  }

  const targetDir = overrideTemplatesDir(cwd);
  const existing = resolved.filter((name) =>
    fse.existsSync(path.join(targetDir, name)),
  );
  if (existing.length > 0 && !opts.force) {
    p.outro(
      pc.red(
        `Already ejected: ${existing.join(", ")}. Re-run with --force to overwrite.`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const registry = await readEjectRegistry(cwd);
  const version = cliVersion();

  for (const name of resolved) {
    const source = path.join(builtInTemplatesDir(), name);
    const content = await fse.readFile(source, "utf8");
    await fse.outputFile(path.join(targetDir, name), content, "utf8");
    registry.templates[name] = {
      builtInHash: sha256(content),
      cliVersion: version,
    };
    p.log.success(
      pc.green(`OK: ${path.join(".ngx-base-cli/templates", name)}`),
    );
  }

  await writeEjectRegistry(cwd, registry);

  p.note(
    [
      "These templates are yours now — edit them freely.",
      "`add` and `update` render from them instead of the built-in ones.",
      "",
      `${pc.cyan("ngx-base-cli eject --list")}   ${pc.dim("# see what is ejected")}`,
      `${pc.cyan("ngx-base-cli update")}         ${pc.dim("# apply them to existing files")}`,
    ].join("\n"),
    "Next",
  );
  p.outro(pc.green("ngx-base-cli eject finished."));
}
