#!/usr/bin/env node
// End-to-end check: `ng new` → `ngx-base-cli init` + `add` → `ng build` (+ a type-check
// of every generated file, including ones nothing imports yet).
//
//   pnpm run build && node scripts/e2e.mjs [scenario ...] [--keep] [--workdir <dir>]
//
// Scenarios (default: all): modern, suffixed-relative-ssr.
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
    : fs.mkdtempSync(path.join(os.tmpdir(), "ng-base-e2e-"));
const skip = new Set(wdIdx >= 0 ? [args[wdIdx + 1]] : []);
const requested = args.filter((a) => !a.startsWith("--") && !skip.has(a));

const isWin = process.platform === "win32";

function run(cmd, cmdArgs, cwd) {
  console.log(`\n$ ${[cmd, ...cmdArgs].join(" ")}   (in ${cwd})`);
  execFileSync(cmd, cmdArgs, { cwd, stdio: "inherit", shell: isWin });
}

const ngb = (cwd, ...a) =>
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

/** sha256 of the project files — `add` of an installed module must not touch them. */
function assertUnchanged(app, fn, what) {
  const before = treeHash(app);
  fn();
  if (treeHash(app) !== before) throw new Error(`${what} changed files`);
}

const SCENARIOS = {
  /** Fresh Angular app (modern naming, alias imports): core, every module, a service. */
  modern() {
    const app = ngNew("modern");
    ngb(app, "init", "--yes");
    ngb(app, "add", "auth", "errors", "logging", "layout", "--yes");
    assertUnchanged(
      app,
      () => ngb(app, "add", "auth", "--yes"),
      "re-adding auth",
    );
    ngb(app, "generate", "service", "user", "--endpoint", "/users");
    ngb(app, "doctor");
    build(app);
  },
  /** SSR app, suffixed naming, relative imports, memory cache; layout before auth. */
  "suffixed-relative-ssr"() {
    const app = ngNew("suffixed-relative-ssr", ["--ssr"]);
    ngb(
      app,
      "init",
      "--yes",
      "--naming",
      "suffixed",
      "--no-tsconfig",
      "--storage",
      "memory",
    );
    ngb(app, "add", "layout", "--yes");
    ngb(app, "add", "auth", "--yes");
    ngb(app, "doctor");
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
  console.error("dist/index.js not found — run `pnpm run build` first.");
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
