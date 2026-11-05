import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildConfigJsonSchema,
  CONFIG_SCHEMA_URL,
  DEFAULT_CONFIG,
  migrateLegacyConfig,
  readNgBaseConfig,
  writeNgBaseConfig,
} from "../src/lib/config";

let dir: string;
const file = () => path.join(dir, ".ngx-base-cli.json");
const write = (obj: unknown) => fse.writeFile(file(), JSON.stringify(obj));

beforeEach(async () => {
  dir = await fse.mkdtemp(path.join(os.tmpdir(), "ng-base-config-"));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fse.remove(dir);
});

describe("readNgBaseConfig", () => {
  it("returns null when config is absent", async () => {
    expect(await readNgBaseConfig(dir)).toBeNull();
  });

  it("merges partial config over defaults", async () => {
    await write({ baseApiUrl: "https://x.test" });
    const cfg = await readNgBaseConfig(dir);
    expect(cfg?.baseApiUrl).toBe("https://x.test");
    expect(cfg?.storageEngine).toBe(DEFAULT_CONFIG.storageEngine);
    expect(cfg?.modules).toEqual([]);
  });

  it("configs without `naming` keep the suffixed style", async () => {
    await write({ outputDir: "src/app/core" });
    const cfg = await readNgBaseConfig(dir);
    expect(cfg?.naming).toBe("suffixed");
    expect(cfg?.project).toBe("");
  });

  it("rejects an invalid naming value", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await write({ naming: "kebab" });
    expect((await readNgBaseConfig(dir))?.naming).toBe("suffixed");
    expect(warn).toHaveBeenCalled();
  });

  it("warns on unknown keys and ignores them", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await write({ baseApiUrl: "https://x.test", bogusKey: 1 });
    const cfg = await readNgBaseConfig(dir);
    expect(cfg?.baseApiUrl).toBe("https://x.test");
    expect(cfg).not.toHaveProperty("bogusKey");
    expect(warn).toHaveBeenCalled();
  });

  it("falls back to default on wrong value type or invalid enum", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await write({ outputDir: 5, storageEngine: "bogus", modules: "auth" });
    const cfg = await readNgBaseConfig(dir);
    expect(cfg?.outputDir).toBe(DEFAULT_CONFIG.outputDir);
    expect(cfg?.storageEngine).toBe(DEFAULT_CONFIG.storageEngine);
    expect(cfg?.modules).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("drops unknown and duplicate modules", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await write({ modules: ["auth", "charts", "auth", "layout"] });
    expect((await readNgBaseConfig(dir))?.modules).toEqual(["auth", "layout"]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("0.1 config migration", () => {
  it("maps generate* flags to modules and drops removed keys", () => {
    expect(
      migrateLegacyConfig({
        $schema: "x",
        baseApiUrl: "https://a.test",
        generateProjectStructure: true,
        generateAuthInterceptor: true,
        generateErrorInterceptor: false,
        generateLoggingInterceptor: true,
        generateBarrel: true,
        authTokenName: "AUTH_TOKEN",
      }),
    ).toEqual({
      baseApiUrl: "https://a.test",
      modules: ["auth", "logging", "layout"],
    });
  });

  it("migrates a 0.1 .ngx-base-cli.json in place", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const legacy = path.join(dir, ".ngx-base-cli.json");
    await fse.writeJson(legacy, {
      outputDir: "src/app/core",
      naming: "modern",
      generateAuthInterceptor: true,
      generateErrorInterceptor: true,
      generateBarrel: true,
    });
    const cfg = await readNgBaseConfig(dir);
    expect(cfg?.modules).toEqual(["auth", "errors"]);
    expect(cfg?.naming).toBe("modern");
    const written = await fse.readJson(file());
    expect(written.modules).toEqual(["auth", "errors"]);
    expect(written).not.toHaveProperty("generateAuthInterceptor");
  });
});

describe("writeNgBaseConfig", () => {
  it("round-trips through read", async () => {
    await writeNgBaseConfig(dir, {
      ...DEFAULT_CONFIG,
      baseApiUrl: "https://rt.test",
      modules: ["errors"],
    });
    const cfg = await readNgBaseConfig(dir);
    expect(cfg?.baseApiUrl).toBe("https://rt.test");
    expect(cfg?.modules).toEqual(["errors"]);
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
      properties: Record<string, { items?: { enum?: string[] } }>;
    };
    for (const key of Object.keys(DEFAULT_CONFIG)) {
      expect(schema.properties).toHaveProperty(key);
    }
    expect(schema.properties.modules?.items?.enum).toEqual([
      "auth",
      "errors",
      "logging",
      "layout",
    ]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await writeNgBaseConfig(dir, DEFAULT_CONFIG);
    const raw = await fse.readJson(file());
    expect(raw.$schema).toBe(CONFIG_SCHEMA_URL);
    await readNgBaseConfig(dir);
    expect(warn).not.toHaveBeenCalled();
  });
});
