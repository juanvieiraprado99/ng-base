import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInit } from "../src/commands/init";
import { runUpdate } from "../src/commands/update";
import { readManifest, sha256 } from "../src/lib/manifest";

let dir: string;
const BASE_SERVICE = "src/app/core/services/base.service.ts";

async function scaffoldProject(): Promise<void> {
  await fse.outputJson(path.join(dir, "package.json"), {
    name: "demo",
    dependencies: { "@angular/core": "^22.0.1" },
  });
}

beforeEach(async () => {
  dir = await fse.mkdtemp(path.join(os.tmpdir(), "ngx-update-"));
  await scaffoldProject();
  await runInit(dir, { preset: "minimal" });
});
afterEach(async () => {
  await fse.remove(dir);
  process.exitCode = 0;
});

function read(rel: string): Promise<string> {
  return fse.readFile(path.join(dir, rel), "utf8");
}

describe("runUpdate", () => {
  it("leaves an in-sync project untouched", async () => {
    const before = await read(BASE_SERVICE);
    await runUpdate(dir, true, false);
    expect(await read(BASE_SERVICE)).toBe(before);
  });

  it("regenerates a file that drifted from the template", async () => {
    // Simulate pristine-but-stale output: disk and manifest agree, both differ
    // from what the template renders now.
    const stale = "// stale CLI output\n";
    await fse.outputFile(path.join(dir, BASE_SERVICE), stale);
    const manifest = await readManifest(dir);
    manifest.files[BASE_SERVICE] = {
      hash: sha256(stale),
      template: manifest.files[BASE_SERVICE].template,
    };
    await fse.writeJson(
      path.join(dir, ".ngx-base-cli.manifest.json"),
      manifest,
      { spaces: 2 },
    );

    await runUpdate(dir, true, false);

    expect(await read(BASE_SERVICE)).not.toBe(stale);
    expect(await read(BASE_SERVICE)).toContain("export class BaseService");
  });

  it("keeps a locally edited file and its previous manifest hash", async () => {
    const edited = `${await read(BASE_SERVICE)}\n// my own change\n`;
    await fse.outputFile(path.join(dir, BASE_SERVICE), edited);
    const hashBefore = (await readManifest(dir)).files[BASE_SERVICE].hash;

    await runUpdate(dir, true, false);

    expect(await read(BASE_SERVICE)).toBe(edited);
    // The old hash is retained so the file keeps classifying as `edited`.
    expect((await readManifest(dir)).files[BASE_SERVICE].hash).toBe(hashBefore);
  });

  it("overwrites a locally edited file only with --force", async () => {
    const edited = `${await read(BASE_SERVICE)}\n// my own change\n`;
    await fse.outputFile(path.join(dir, BASE_SERVICE), edited);

    await runUpdate(dir, true, true);

    const after = await read(BASE_SERVICE);
    expect(after).not.toBe(edited);
    expect((await readManifest(dir)).files[BASE_SERVICE].hash).toBe(
      sha256(after),
    );
  });

  it("recreates a deleted file", async () => {
    await fse.remove(path.join(dir, BASE_SERVICE));
    await runUpdate(dir, true, false);
    expect(await fse.pathExists(path.join(dir, BASE_SERVICE))).toBe(true);
  });
});
