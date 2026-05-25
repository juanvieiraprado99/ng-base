import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  importBetweenFiles,
  importFromSrcApp,
  toPosix,
} from "../src/lib/import-paths";

describe("toPosix", () => {
  it("converts native separators to forward slashes", () => {
    expect(toPosix(["a", "b", "c"].join(path.sep))).toBe("a/b/c");
  });
});

describe("importBetweenFiles", () => {
  it("builds a relative specifier and strips .ts", () => {
    const from = path.join("/proj/src/app/core/services", "user.service.ts");
    const to = path.join("/proj/src/app/core/services", "base.service.ts");
    expect(importBetweenFiles(from, to)).toBe("./base.service");
  });

  it("walks up directories", () => {
    const from = path.join("/proj/src/app", "app.config.ts");
    const to = path.join("/proj/src/environments", "environment.ts");
    expect(importBetweenFiles(from, to)).toBe("../environments/environment");
  });
});

describe("importFromSrcApp", () => {
  it("is relative to src/app and strips .ts", () => {
    const target = path.join("/proj/src/app/core/services", "cache.service.ts");
    expect(importFromSrcApp("/proj", target)).toBe(
      "./core/services/cache.service",
    );
  });
});
