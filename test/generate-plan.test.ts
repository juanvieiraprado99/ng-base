import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_NGX_BASE_CONFIG,
  type NgxBaseCliConfig,
} from "../src/lib/config";
import { buildGenerationTargets } from "../src/lib/generate-plan";
import { PRESETS } from "../src/lib/presets";

const CWD = "/proj";

function relPaths(config: NgxBaseCliConfig): string[] {
  return buildGenerationTargets(CWD, config).map((t) =>
    path.relative(CWD, t.outPath).split(path.sep).join("/"),
  );
}

describe("buildGenerationTargets", () => {
  it("minimal preset: core services + interfaces + envs + barrel, no interceptors", () => {
    const paths = relPaths(PRESETS.minimal);
    expect(paths).toContain("src/app/core/services/base.service.ts");
    expect(paths).toContain("src/app/core/services/cache.service.ts");
    expect(paths).toContain("src/app/core/interfaces/cache.interface.ts");
    expect(paths).toContain("src/environments/environment.ts");
    expect(paths).toContain("src/environments/environment.prod.ts");
    expect(paths).toContain("src/app/core/services/index.ts");
    expect(paths.some((p) => p.includes("interceptors/"))).toBe(false);
  });

  it("standard preset: adds auth + error interceptors", () => {
    const paths = relPaths(PRESETS.standard);
    expect(paths).toContain("src/app/core/interceptors/auth.interceptor.ts");
    expect(paths).toContain("src/app/core/interceptors/error.interceptor.ts");
    expect(paths).not.toContain(
      "src/app/core/interceptors/logging.interceptor.ts",
    );
  });

  it("full preset: adds project structure (layout/pages/routes)", () => {
    const paths = relPaths(PRESETS.full);
    expect(paths).toContain("src/app/app.routes.ts");
    expect(paths.some((p) => p.startsWith("src/app/layout/"))).toBe(true);
    expect(paths.some((p) => p.startsWith("src/app/pages/"))).toBe(true);
  });

  it("full preset: empty folders are dir-only targets, no .gitkeep", () => {
    const targets = buildGenerationTargets(CWD, PRESETS.full);
    const paths = targets.map((t) =>
      path.relative(CWD, t.outPath).split(path.sep).join("/"),
    );
    expect(paths.some((p) => p.endsWith(".gitkeep"))).toBe(false);

    const dirTargets = targets.filter((t) => t.dirOnly);
    const dirPaths = dirTargets.map((t) =>
      path.relative(CWD, t.outPath).split(path.sep).join("/"),
    );
    expect(dirPaths).toContain("src/app/core/directives");
    expect(dirPaths).toContain("src/app/shared");
  });

  it("httpResource flag selects the httpresource base template", () => {
    const targets = buildGenerationTargets(CWD, {
      ...DEFAULT_NGX_BASE_CONFIG,
      useHttpResource: true,
    });
    const base = targets.find((t) => t.outPath.endsWith("base.service.ts"));
    expect(base?.template).toBe("base.service.httpresource.ts.tpl");
  });

  it("storageEngine selects matching cache template", () => {
    const targets = buildGenerationTargets(CWD, {
      ...DEFAULT_NGX_BASE_CONFIG,
      storageEngine: "memory",
    });
    const cache = targets.find((t) => t.outPath.endsWith("cache.service.ts"));
    expect(cache?.template).toBe("cache.service.memory.ts.tpl");
  });

  it("no barrel when generateBarrel is false", () => {
    const paths = relPaths({
      ...DEFAULT_NGX_BASE_CONFIG,
      generateBarrel: false,
    });
    expect(paths).not.toContain("src/app/core/services/index.ts");
  });
});
