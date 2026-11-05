import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildConfigJsonSchema,
  CONFIG_SCHEMA_URL,
  DEFAULT_NGX_BASE_CONFIG,
  readNgxBaseConfig,
  writeNgxBaseConfig,
} from "../src/lib/config";

let dir: string;

beforeEach(async () => {
  dir = await fse.mkdtemp(path.join(os.tmpdir(), "ngx-config-"));
});
afterEach(async () => {
  await fse.remove(dir);
});

describe("readNgxBaseConfig", () => {
  it("returns null when config is absent", async () => {
    expect(await readNgxBaseConfig(dir)).toBeNull();
  });

  it("merges partial config over defaults", async () => {
    await fse.writeFile(
      path.join(dir, ".ngx-base-cli.json"),
      JSON.stringify({ baseApiUrl: "https://x.test" }),
    );
    const cfg = await readNgxBaseConfig(dir);
    expect(cfg?.baseApiUrl).toBe("https://x.test");
    expect(cfg?.storageEngine).toBe(DEFAULT_NGX_BASE_CONFIG.storageEngine);
  });

  it("configs written before `naming` existed keep the suffixed style", async () => {
    await fse.writeFile(
      path.join(dir, ".ngx-base-cli.json"),
      JSON.stringify({ outputDir: "src/app/core" }),
    );
    const cfg = await readNgxBaseConfig(dir);
    expect(cfg?.naming).toBe("suffixed");
    expect(cfg?.project).toBe("");
  });

  it("rejects an invalid naming value", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await fse.writeFile(
      path.join(dir, ".ngx-base-cli.json"),
      JSON.stringify({ naming: "kebab" }),
    );
    expect((await readNgxBaseConfig(dir))?.naming).toBe("suffixed");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns on unknown keys and ignores them", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await fse.writeFile(
      path.join(dir, ".ngx-base-cli.json"),
      JSON.stringify({ baseApiUrl: "https://x.test", bogusKey: 1 }),
    );
    const cfg = await readNgxBaseConfig(dir);
    expect(cfg?.baseApiUrl).toBe("https://x.test");
    expect(cfg).not.toHaveProperty("bogusKey");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("falls back to default on wrong value type", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await fse.writeFile(
      path.join(dir, ".ngx-base-cli.json"),
      JSON.stringify({ generateBarrel: "yes", outputDir: 5 }),
    );
    const cfg = await readNgxBaseConfig(dir);
    expect(cfg?.generateBarrel).toBe(DEFAULT_NGX_BASE_CONFIG.generateBarrel);
    expect(cfg?.outputDir).toBe(DEFAULT_NGX_BASE_CONFIG.outputDir);
    warn.mockRestore();
  });

  it("falls back to default on invalid enum and warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await fse.writeFile(
      path.join(dir, ".ngx-base-cli.json"),
      JSON.stringify({ storageEngine: "bogus", importStyle: "weird" }),
    );
    const cfg = await readNgxBaseConfig(dir);
    expect(cfg?.storageEngine).toBe(DEFAULT_NGX_BASE_CONFIG.storageEngine);
    expect(cfg?.importStyle).toBe(DEFAULT_NGX_BASE_CONFIG.importStyle);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("writeNgxBaseConfig", () => {
  it("round-trips through read", async () => {
    await writeNgxBaseConfig(dir, {
      ...DEFAULT_NGX_BASE_CONFIG,
      baseApiUrl: "https://rt.test",
    });
    const cfg = await readNgxBaseConfig(dir);
    expect(cfg?.baseApiUrl).toBe("https://rt.test");
  });
});

describe("config JSON Schema", () => {
  it("schema.json is in sync with CONFIG_FIELDS (run `npm run schema`)", async () => {
    const committed = await fse.readJson(
      path.join(__dirname, "..", "schema.json"),
    );
    expect(committed).toEqual(buildConfigJsonSchema());
  });

  it("covers every config key and the written file carries $schema", async () => {
    const schema = buildConfigJsonSchema() as {
      properties: Record<string, unknown>;
    };
    for (const key of Object.keys(DEFAULT_NGX_BASE_CONFIG)) {
      expect(schema.properties).toHaveProperty(key);
    }
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await writeNgxBaseConfig(dir, DEFAULT_NGX_BASE_CONFIG);
    const raw = await fse.readJson(path.join(dir, ".ngx-base-cli.json"));
    expect(raw.$schema).toBe(CONFIG_SCHEMA_URL);
    await readNgxBaseConfig(dir);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
