import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sha256 } from "../src/lib/manifest";
import {
  builtInTemplatesDir,
  listBuiltInTemplates,
  listOverrideTemplates,
  overrideTemplatesDir,
  readEjectRegistry,
  resolveTemplateName,
  resolveTemplatePath,
  templateStatuses,
  writeEjectRegistry,
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

describe("resolveTemplateName", () => {
  const names = [
    "feature.component.html.tpl",
    "feature.component.spec.ts.tpl",
    "feature.component.ts.tpl",
    "feature.service.spec.ts.tpl",
    "feature.service.ts.tpl",
  ];

  it("accepts the bare name", () => {
    expect(resolveTemplateName("feature.service", names)).toBe(
      "feature.service.ts.tpl",
    );
    expect(resolveTemplateName("feature.service.spec", names)).toBe(
      "feature.service.spec.ts.tpl",
    );
    expect(resolveTemplateName("feature.component.html", names)).toBe(
      "feature.component.html.tpl",
    );
  });

  it("accepts the full filename", () => {
    expect(resolveTemplateName("feature.service.ts.tpl", names)).toBe(
      "feature.service.ts.tpl",
    );
  });

  it("errors with the candidate list when nothing matches", () => {
    expect(() => resolveTemplateName("nope", names)).toThrow(
      /Unknown template "nope"/,
    );
  });
});

describe("eject registry", () => {
  it("reads an empty registry when the file is missing", async () => {
    expect(await readEjectRegistry(dir)).toEqual({ version: 1, templates: {} });
  });

  it("round-trips entries", async () => {
    await writeEjectRegistry(dir, {
      version: 1,
      templates: {
        "feature.guard.ts.tpl": { builtInHash: "abc", cliVersion: "0.2.0" },
      },
    });
    const registry = await readEjectRegistry(dir);
    expect(registry.templates["feature.guard.ts.tpl"].builtInHash).toBe("abc");
  });

  it("treats a corrupt registry as empty", async () => {
    await fse.outputFile(
      path.join(dir, ".ngx-base-cli", "templates.json"),
      "{ not json",
    );
    expect(await readEjectRegistry(dir)).toEqual({ version: 1, templates: {} });
  });
});

describe("templateStatuses", () => {
  it("reports every built-in as not ejected by default", async () => {
    const statuses = await templateStatuses(dir);
    expect(statuses.length).toBeGreaterThan(30);
    expect(statuses.every((s) => !s.ejected)).toBe(true);
    expect(statuses.every((s) => !s.orphaned)).toBe(true);
  });

  it("marks an ejected template, and flags it stale when the built-in moved on", async () => {
    await writeOverride("feature.guard.ts.tpl", "custom");
    await writeEjectRegistry(dir, {
      version: 1,
      templates: {
        "feature.guard.ts.tpl": {
          builtInHash: "stale-hash",
          cliVersion: "0.2.0",
        },
      },
    });

    const status = (await templateStatuses(dir)).find(
      (s) => s.name === "feature.guard.ts.tpl",
    );
    expect(status).toMatchObject({ ejected: true, stale: true });
  });

  it("is not stale when the recorded hash still matches the built-in", async () => {
    const builtIn = await fse.readFile(
      path.join(builtInTemplatesDir(), "feature.guard.ts.tpl"),
      "utf8",
    );
    await writeOverride("feature.guard.ts.tpl", "custom");
    await writeEjectRegistry(dir, {
      version: 1,
      templates: {
        "feature.guard.ts.tpl": {
          builtInHash: sha256(builtIn),
          cliVersion: "0.2.0",
        },
      },
    });

    const status = (await templateStatuses(dir)).find(
      (s) => s.name === "feature.guard.ts.tpl",
    );
    expect(status).toMatchObject({ ejected: true, stale: false });
  });

  it("reports an override with no built-in as orphaned", async () => {
    await writeOverride("removed.by.a.newer.cli.tpl", "x");
    const status = (await templateStatuses(dir)).find(
      (s) => s.name === "removed.by.a.newer.cli.tpl",
    );
    expect(status).toMatchObject({ ejected: true, orphaned: true });
  });
});
