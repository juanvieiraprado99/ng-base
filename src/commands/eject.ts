import path from "node:path";
import * as p from "@clack/prompts";
import fse from "fs-extra";
import pc from "picocolors";
import { formatDiff } from "../lib/diff.js";
import { sha256 } from "../lib/manifest.js";
import {
  builtInTemplatesDir,
  cliVersion,
  listBuiltInTemplates,
  listOverrideTemplates,
  overrideTemplatesDir,
  readEjectRegistry,
  resolveTemplateName,
  templateStatuses,
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

  if (opts.list) {
    await printTemplateList(cwd);
    return;
  }

  if (opts.diff) {
    await printTemplateDiff(cwd, opts.diff);
    return;
  }

  if (opts.revert) {
    await revertTemplates(names, cwd, opts.yes ?? false);
    return;
  }

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

async function printTemplateList(cwd: string): Promise<void> {
  const statuses = await templateStatuses(cwd);
  const width = Math.max(...statuses.map((s) => s.name.length));

  const body = statuses
    .map((s) => {
      const name = s.name.padEnd(width);
      if (s.orphaned) {
        return `${pc.red("??")}  ${name}  ${pc.red("orphaned — no built-in with this name")}`;
      }
      if (s.stale) {
        return `${pc.yellow("!!")}  ${name}  ${pc.yellow("ejected — built-in changed since eject")}`;
      }
      if (s.ejected) {
        return `${pc.magenta("~~")}  ${name}  ${pc.magenta("ejected")}`;
      }
      return `${pc.dim("--")}  ${pc.dim(name)}  ${pc.dim("built-in")}`;
    })
    .join("\n");
  p.note(body, "Templates");

  const ejected = statuses.filter((s) => s.ejected).length;
  const stale = statuses.filter((s) => s.stale).length;
  const parts = [`${statuses.length} templates`, `${ejected} ejected`];
  if (stale > 0) {
    parts.push(pc.yellow(`${stale} behind the built-in`));
  }
  p.outro(parts.join(pc.dim(" · ")));
}

async function printTemplateDiff(cwd: string, input: string): Promise<void> {
  const builtIn = await listBuiltInTemplates();
  let name: string;
  try {
    name = resolveTemplateName(input, builtIn);
  } catch (err) {
    p.outro(pc.red(err instanceof Error ? err.message : String(err)));
    process.exitCode = 1;
    return;
  }

  const overridePath = path.join(overrideTemplatesDir(cwd), name);
  if (!(await fse.pathExists(overridePath))) {
    p.outro(
      pc.red(
        `"${name}" is not ejected — there is nothing to compare. Run \`ngx-base-cli eject ${input}\` first.`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const override = await fse.readFile(overridePath, "utf8");
  const current = await fse.readFile(
    path.join(builtInTemplatesDir(), name),
    "utf8",
  );

  if (override === current) {
    p.outro(pc.green(`${name} is identical to the built-in template.`));
    return;
  }

  p.log.message(
    `${pc.bold(name)} ${pc.dim("(- your copy, + current built-in)")}`,
  );
  console.log(formatDiff(override, current));
  p.outro(
    pc.dim(
      "Merge anything you want from the built-in into your copy by hand, then re-run `ngx-base-cli update`.",
    ),
  );
}

async function revertTemplates(
  names: string[],
  cwd: string,
  yes: boolean,
): Promise<void> {
  // Revert must also work for orphaned overrides, so resolve against what is
  // actually on disk rather than against the built-in list.
  const overrides = await listOverrideTemplates(cwd);
  const resolved: string[] = [];
  for (const input of names) {
    try {
      resolved.push(resolveTemplateName(input, overrides));
    } catch {
      p.log.warn(pc.yellow(`Not ejected: ${input} — skipped.`));
    }
  }

  if (resolved.length === 0) {
    p.outro(pc.yellow("Nothing to revert."));
    return;
  }

  p.note(
    resolved
      .map((n) => pc.red(path.join(".ngx-base-cli/templates", n)))
      .join("\n"),
    "Will delete",
  );

  if (!yes && process.stdin.isTTY) {
    const confirmed = await p.confirm({
      message: `Delete ${resolved.length} override(s) and fall back to the built-in templates?`,
      initialValue: false,
    });
    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Cancelled.");
      return;
    }
  }

  const registry = await readEjectRegistry(cwd);
  for (const name of resolved) {
    await fse.remove(path.join(overrideTemplatesDir(cwd), name));
    delete registry.templates[name];
    p.log.success(pc.green(`Reverted: ${name}`));
  }
  await writeEjectRegistry(cwd, registry);

  p.outro(pc.green("ngx-base-cli eject finished."));
}
