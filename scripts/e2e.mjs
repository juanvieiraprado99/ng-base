#!/usr/bin/env node
// End-to-end check: `ng new` → `ngx-base-cli init` → `ng build` (+ a type-check
// of every generated file, including ones nothing imports yet).
//
//   npm run build && node scripts/e2e.mjs [scenario ...] [--keep] [--workdir <dir>]
//
// Scenarios (default: all): modern-full, suffixed-relative-ssr.
// Needs network for `ng new` (npm install). Used by the CI `e2e` job.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(repo, "dist", "index.js");
const ANGULAR_CLI = process.env.E2E_ANGULAR_CLI ?? "@angular/cli@latest";

const args = process.argv.slice(2);
const keep = args.includes("--keep");
const wdIdx = args.indexOf("--workdir");
const workdir =
  wdIdx >= 0
    ? path.resolve(args[wdIdx + 1])
    : fs.mkdtempSync(path.join(os.tmpdir(), "ngx-base-e2e-"));
const skip = new Set(wdIdx >= 0 ? [args[wdIdx + 1]] : []);
const requested = args.filter((a) => !a.startsWith("--") && !skip.has(a));

const isWin = process.platform === "win32";

function run(cmd, cmdArgs, cwd) {
  console.log(`\n$ ${[cmd, ...cmdArgs].join(" ")}   (in ${cwd})`);
  execFileSync(cmd, cmdArgs, { cwd, stdio: "inherit", shell: isWin });
}

const ngx = (cwd, ...a) =>
  run(process.execPath, [cli, ...a, "--cwd", cwd], cwd);
const ng = (cwd, ...a) => run("npx", ["ng", ...a], cwd);

function ngNew(name, extra = []) {
  run(
    "npx",
    [
      "-y",
      ANGULAR_CLI,
      "new",
      name,
      "--defaults",
      "--skip-git",
      "--interactive=false",
      ...extra,
    ],
    workdir,
  );
  return path.join(workdir, name);
}

/** sha256 of every project file (sans build output / deps) — detects churn. */
function treeHash(dir) {
  const h = createHash("sha256");
  const walk = (d) => {
    for (const e of fs
      .readdirSync(d, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      if (["node_modules", ".angular", "dist"].includes(e.name)) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else h.update(path.relative(dir, full)).update(fs.readFileSync(full));
    }
  };
  walk(dir);
  return h.digest("hex");
}

function build(app) {
  ng(app, "build");
  // ng build only compiles what main.ts reaches; check the rest of the core too.
  run("npx", ["tsc", "-p", "tsconfig.app.json", "--noEmit"], app);
}

function assertStableUpdate(app) {
  const before = treeHash(app);
  ngx(app, "update", "--yes");
  if (treeHash(app) !== before) {
    throw new Error("`update` right after `init` changed files");
  }
}

function patchConfig(app, patch) {
  const file = path.join(app, ".ngx-base-cli.json");
  const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, `${JSON.stringify({ ...cfg, ...patch }, null, 2)}\n`);
}

const SCENARIOS = {
  /** Fresh Angular app (modern naming), full preset, alias imports, `add` artifacts. */
  "modern-full"() {
    const app = ngNew("modern-full");
    ngx(app, "init", "--preset", "full", "--yes");
    assertStableUpdate(app);
    ngx(app, "add", "user");
    ngx(app, "add", "user-card", "--type", "component");
    ngx(app, "add", "truncate", "--type", "pipe");
    ngx(app, "add", "highlight", "--type", "directive");
    ngx(app, "doctor");
    build(app);
  },
  /** SSR app, suffixed naming, relative imports, memory cache + httpResource. */
  "suffixed-relative-ssr"() {
    const app = ngNew("suffixed-relative-ssr", ["--ssr"]);
    ngx(
      app,
      "init",
      "--preset",
      "full",
      "--yes",
      "--naming",
      "suffixed",
      "--no-tsconfig",
    );
    patchConfig(app, { storageEngine: "memory", useHttpResource: true });
    ngx(app, "update", "--yes");
    assertStableUpdate(app);
    ngx(app, "doctor");
    build(app);
  },
};

const names = requested.length ? requested : Object.keys(SCENARIOS);
for (const n of names) {
  if (!SCENARIOS[n]) {
    console.error(
      `Unknown scenario "${n}". Available: ${Object.keys(SCENARIOS).join(", ")}`,
    );
    process.exit(2);
  }
}
if (!fs.existsSync(cli)) {
  console.error("dist/index.js not found — run `npm run build` first.");
  process.exit(2);
}

let failed = false;
for (const n of names) {
  console.log(`\n=== e2e: ${n} ===`);
  try {
    SCENARIOS[n]();
    console.log(`\n✔ ${n}`);
  } catch (err) {
    failed = true;
    console.error(`\n✖ ${n}: ${err instanceof Error ? err.message : err}`);
  }
}
if (!keep && wdIdx < 0) fs.rmSync(workdir, { recursive: true, force: true });
else console.log(`\nWork dir kept: ${workdir}`);
process.exit(failed ? 1 : 0);
