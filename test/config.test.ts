import fse from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
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
      JSON.stringify({ baseApiUrl: "https://x.test" })
    );
    const cfg = await readNgxBaseConfig(dir);
    expect(cfg?.baseApiUrl).toBe("https://x.test");
    expect(cfg?.storageEngine).toBe(DEFAULT_NGX_BASE_CONFIG.storageEngine);
  });

  it("warns on unknown keys and ignores them", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await fse.writeFile(
      path.join(dir, ".ngx-base-cli.json"),
      JSON.stringify({ baseApiUrl: "https://x.test", bogusKey: 1 })
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
      JSON.stringify({ generateBarrel: "yes", outputDir: 5 })
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
      JSON.stringify({ storageEngine: "bogus", importStyle: "weird" })
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
