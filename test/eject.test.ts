import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runAdd } from "../src/commands/add";
import { runEject } from "../src/commands/eject";
import { runInit } from "../src/commands/init";
import {
  builtInTemplatesDir,
  overrideTemplatesDir,
  readEjectRegistry,
  templateStatuses,
} from "../src/lib/template-registry";

let dir: string;

beforeEach(async () => {
  dir = await fse.mkdtemp(path.join(os.tmpdir(), "ngx-eject-"));
});
afterEach(async () => {
  await fse.remove(dir);
  process.exitCode = 0;
});

function overridePath(name: string): string {
  return path.join(overrideTemplatesDir(dir), name);
}

describe("runEject", () => {
  it("copies a template by its bare name and records the built-in hash", async () => {
    await runEject(["feature.guard"], dir, {});

    const copied = await fse.readFile(
      overridePath("feature.guard.ts.tpl"),
      "utf8",
    );
    const builtIn = await fse.readFile(
      path.join(builtInTemplatesDir(), "feature.guard.ts.tpl"),
      "utf8",
    );
    expect(copied).toBe(builtIn);

    const registry = await readEjectRegistry(dir);
    expect(registry.templates["feature.guard.ts.tpl"].builtInHash).toHaveLength(
      64,
    );
  });

  it("ejects several templates at once", async () => {
    await runEject(["feature.guard", "feature.pipe"], dir, {});

    expect(await fse.pathExists(overridePath("feature.guard.ts.tpl"))).toBe(
      true,
    );
    expect(await fse.pathExists(overridePath("feature.pipe.ts.tpl"))).toBe(
      true,
    );
  });

  it("fails on an unknown template without writing anything", async () => {
    await runEject(["not-a-template"], dir, {});

    expect(process.exitCode).toBe(1);
    expect(await fse.pathExists(overrideTemplatesDir(dir))).toBe(false);
  });

  it("refuses to overwrite an existing override without --force", async () => {
    await fse.outputFile(overridePath("feature.guard.ts.tpl"), "mine");

    await runEject(["feature.guard"], dir, {});

    expect(process.exitCode).toBe(1);
    expect(
      await fse.readFile(overridePath("feature.guard.ts.tpl"), "utf8"),
    ).toBe("mine");
  });

  it("--force overwrites and refreshes the recorded hash", async () => {
    await fse.outputFile(overridePath("feature.guard.ts.tpl"), "mine");

    await runEject(["feature.guard"], dir, { force: true });

    const copied = await fse.readFile(
      overridePath("feature.guard.ts.tpl"),
      "utf8",
    );
    expect(copied).not.toBe("mine");
    expect(process.exitCode).toBe(0);
  });
});

describe("an ejected template drives real generation", () => {
  beforeEach(async () => {
    await fse.outputJson(path.join(dir, "package.json"), {
      name: "demo",
      dependencies: { "@angular/core": "^22.0.1" },
    });
    await runInit(dir, { preset: "minimal" });
  });

  it("add renders from the project's copy", async () => {
    await runEject(["feature.service"], dir, {});
    await fse.outputFile(
      overridePath("feature.service.ts.tpl"),
      "// house style\nexport class {{SERVICE_CLASS_NAME}} {}\n",
    );

    await runAdd("user", "service", dir, { skipTests: true });

    expect(
      await fse.readFile(
        path.join(dir, "src/app/core/services/user.ts"),
        "utf8",
      ),
    ).toBe("// house style\nexport class UserService {}\n");
  });

  it("reverting restores the built-in output", async () => {
    await runEject(["feature.service"], dir, {});
    await fse.outputFile(
      overridePath("feature.service.ts.tpl"),
      "// house style\nexport class {{SERVICE_CLASS_NAME}} {}\n",
    );
    await runEject(["feature.service"], dir, { revert: true, yes: true });

    await runAdd("user", "service", dir, { skipTests: true });

    expect(
      await fse.readFile(
        path.join(dir, "src/app/core/services/user.ts"),
        "utf8",
      ),
    ).toContain("extends BaseService");
  });
});

describe("runEject --list", () => {
  it("does not require any names", async () => {
    await runEject([], dir, { list: true });
    expect(process.exitCode).toBe(0);
  });

  it("reports an ejected template as stale when the recorded hash is wrong", async () => {
    await runEject(["feature.guard"], dir, {});

    const registryPath = path.join(dir, ".ngx-base-cli", "templates.json");
    const registry = await fse.readJson(registryPath);
    registry.templates["feature.guard.ts.tpl"].builtInHash = "0".repeat(64);
    await fse.writeJson(registryPath, registry, { spaces: 2 });

    const statuses = await templateStatuses(dir);
    expect(
      statuses.find((s) => s.name === "feature.guard.ts.tpl"),
    ).toMatchObject({ ejected: true, stale: true });
  });
});

describe("runEject --diff", () => {
  it("errors when the template is not ejected", async () => {
    await runEject([], dir, { diff: "feature.guard" });
    expect(process.exitCode).toBe(1);
  });

  it("succeeds for an ejected template", async () => {
    await runEject(["feature.guard"], dir, {});
    await fse.outputFile(
      overridePath("feature.guard.ts.tpl"),
      "// our own guard\n",
    );

    await runEject([], dir, { diff: "feature.guard" });
    expect(process.exitCode).toBe(0);
  });
});

describe("runEject --revert", () => {
  it("deletes the override and its registry entry", async () => {
    await runEject(["feature.guard"], dir, {});
    expect(await fse.pathExists(overridePath("feature.guard.ts.tpl"))).toBe(
      true,
    );

    await runEject(["feature.guard"], dir, { revert: true, yes: true });

    expect(await fse.pathExists(overridePath("feature.guard.ts.tpl"))).toBe(
      false,
    );
    const registry = await readEjectRegistry(dir);
    expect(registry.templates["feature.guard.ts.tpl"]).toBeUndefined();
  });

  it("reports when there was nothing to revert", async () => {
    await runEject(["feature.guard"], dir, { revert: true, yes: true });
    expect(process.exitCode).toBe(0);
  });

  it("reverts an orphaned override too", async () => {
    await fse.outputFile(overridePath("removed.by.newer.cli.tpl"), "x");

    await runEject(["removed.by.newer.cli.tpl"], dir, {
      revert: true,
      yes: true,
    });

    expect(await fse.pathExists(overridePath("removed.by.newer.cli.tpl"))).toBe(
      false,
    );
  });
});
