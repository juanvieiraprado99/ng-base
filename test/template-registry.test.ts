import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  builtInTemplatesDir,
  listBuiltInTemplates,
  listOverrideTemplates,
  overrideTemplatesDir,
  resolveTemplatePath,
} from "../src/lib/template-registry";
import { applyTemplate } from "../src/lib/templates";

let dir: string;

beforeEach(async () => {
  dir = await fse.mkdtemp(path.join(os.tmpdir(), "ngx-registry-"));
});
afterEach(async () => {
  await fse.remove(dir);
});

async function writeOverride(name: string, content: string): Promise<void> {
  await fse.outputFile(path.join(overrideTemplatesDir(dir), name), content);
}

describe("listBuiltInTemplates", () => {
  it("lists every shipped .tpl file, sorted", async () => {
    const names = await listBuiltInTemplates();
    expect(names).toContain("feature.service.ts.tpl");
    expect(names).toContain("base.service.ts.tpl");
    expect(names.every((n) => n.endsWith(".tpl"))).toBe(true);
    expect([...names].sort()).toEqual(names);
  });
});

describe("listOverrideTemplates", () => {
  it("is empty when the project has no override directory", async () => {
    expect(await listOverrideTemplates(dir)).toEqual([]);
  });

  it("lists only .tpl files in the override directory", async () => {
    await writeOverride("feature.service.ts.tpl", "custom");
    await fse.outputFile(
      path.join(overrideTemplatesDir(dir), "README.md"),
      "x",
    );
    expect(await listOverrideTemplates(dir)).toEqual([
      "feature.service.ts.tpl",
    ]);
  });
});

describe("resolveTemplatePath", () => {
  it("falls back to the built-in when there is no override", async () => {
    const resolved = await resolveTemplatePath("feature.guard.ts.tpl", dir);
    expect(resolved).toBe(
      path.join(builtInTemplatesDir(), "feature.guard.ts.tpl"),
    );
  });

  it("prefers the project override", async () => {
    await writeOverride("feature.guard.ts.tpl", "custom");
    const resolved = await resolveTemplatePath("feature.guard.ts.tpl", dir);
    expect(resolved).toBe(
      path.join(overrideTemplatesDir(dir), "feature.guard.ts.tpl"),
    );
  });
});

describe("applyTemplate with an override", () => {
  it("renders the override instead of the built-in", async () => {
    await writeOverride(
      "feature.guard.ts.tpl",
      "// house style\nexport const {{FN_NAME}} = () => true;\n",
    );
    const out = await applyTemplate(
      "feature.guard.ts.tpl",
      { FN_NAME: "authGuard" },
      dir,
    );
    expect(out).toBe("// house style\nexport const authGuard = () => true;\n");
  });

  it("still reports unreplaced tokens from an override", async () => {
    await writeOverride("feature.guard.ts.tpl", "{{NOT_PROVIDED}}");
    await expect(
      applyTemplate("feature.guard.ts.tpl", {}, dir),
    ).rejects.toThrow(/NOT_PROVIDED/);
  });
});
