import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_NGX_BASE_CONFIG,
  type NgxBaseCliConfig,
} from "../src/lib/config";
import {
  buildGenerationTargets,
  enabledFeatures,
  FEATURES,
} from "../src/lib/generate-plan";
import { PRESETS } from "../src/lib/presets";
import { renderGenerationTarget } from "../src/lib/render-target";

const CWD = "/proj";

function relPaths(config: NgxBaseCliConfig): string[] {
  return buildGenerationTargets(CWD, config).map((t) =>
    path.relative(CWD, t.outPath).split(path.sep).join("/"),
  );
}

describe("buildGenerationTargets", () => {
  it("minimal preset: api client + cache + interfaces + envs + barrel, only the cache interceptor", () => {
    const paths = relPaths(PRESETS.minimal);
    expect(paths).toContain("src/app/core/services/api-client.ts");
    expect(paths).toContain("src/app/core/services/cache.service.ts");
    expect(paths).toContain("src/app/core/services/cache.storage.ts");
    expect(paths).not.toContain("src/app/core/services/base.service.ts");
    expect(paths).toContain("src/app/core/interfaces/cache.interface.ts");
    expect(paths).toContain("src/environments/environment.ts");
    expect(paths).toContain("src/environments/environment.prod.ts");
    expect(paths).toContain("src/app/core/services/index.ts");
    expect(paths.filter((p) => p.includes("interceptors/"))).toEqual([
      "src/app/core/interceptors/cache.interceptor.ts",
    ]);
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

  it("httpResource flag toggles the resource() block of the api client", () => {
    const find = (useHttpResource: boolean) =>
      buildGenerationTargets(CWD, {
        ...DEFAULT_NGX_BASE_CONFIG,
        useHttpResource,
      }).find((t) => t.outPath.endsWith("api-client.ts"))?.vars.HTTP_RESOURCE;
    expect(find(true)).toBe("true");
    expect(find(false)).toBe("false");
  });

  it("storageEngine selects matching cache template", () => {
    const targets = buildGenerationTargets(CWD, {
      ...DEFAULT_NGX_BASE_CONFIG,
      storageEngine: "memory",
    });
    const storage = targets.find((t) => t.outPath.endsWith("cache.storage.ts"));
    expect(storage?.vars.STORAGE_FACTORY).toBe("memoryStorage()");
  });

  it("no barrel when generateBarrel is false", () => {
    const paths = relPaths({
      ...DEFAULT_NGX_BASE_CONFIG,
      generateBarrel: false,
    });
    expect(paths).not.toContain("src/app/core/services/index.ts");
  });

  it("standard preset: generates the auth store and tokens the interceptors import", () => {
    const paths = relPaths(PRESETS.standard);
    expect(paths).toContain("src/app/core/tokens/api.tokens.ts");
    expect(paths).toContain("src/app/core/tokens/routes.tokens.ts");
    expect(paths).toContain("src/app/core/services/auth-token.store.ts");
    expect(paths).toContain("src/app/core/tokens/auth.tokens.ts");
  });

  it("full preset: generates the auth guard; app.html / app.routes.ts are create-only", () => {
    const targets = buildGenerationTargets(CWD, PRESETS.full);
    const rel = (t: { outPath: string }) =>
      path.relative(CWD, t.outPath).split(path.sep).join("/");
    expect(targets.map(rel)).toContain("src/app/core/guards/auth.guard.ts");
    const createOnly = targets.filter((t) => t.createOnly).map(rel);
    expect(createOnly).toEqual(["src/app/app.routes.ts", "src/app/app.html"]);
  });

  it("route imports follow importStyle", () => {
    const find = (config: NgxBaseCliConfig) =>
      buildGenerationTargets(CWD, config).find((t) =>
        t.outPath.endsWith("private.routes.ts"),
      )?.vars;
    expect(find(PRESETS.full)?.IMPORT_LAYOUT_PRIVATE).toBe(
      "@layout/private/private.component",
    );
    expect(find(PRESETS.full)?.IMPORT_AUTH_GUARD).toBe(
      "@core/guards/auth.guard",
    );
    const relative = find({ ...PRESETS.full, importStyle: "relative" });
    expect(relative?.IMPORT_LAYOUT_PRIVATE).toBe(
      "../layout/private/private.component",
    );
    expect(relative?.IMPORT_AUTH_GUARD).toBe("../core/guards/auth.guard");
  });

  it("every target of every preset renders with no leftover tokens", async () => {
    for (const preset of Object.values(PRESETS)) {
      for (const importStyle of ["alias", "relative"] as const) {
        for (const useHttpResource of [false, true]) {
          for (const naming of ["suffixed", "modern"] as const) {
            const targets = buildGenerationTargets(CWD, {
              ...preset,
              importStyle,
              useHttpResource,
              naming,
            });
            for (const t of targets) {
              if (t.dirOnly) continue;
              const out = await renderGenerationTarget(t);
              expect(out).not.toMatch(/\{\{[#/A-Z0-9_ ]+\}\}/);
            }
          }
        }
      }
    }
  });

  it("modern naming: suffixless core + structure files, class names follow", () => {
    const config = { ...PRESETS.full, naming: "modern" as const };
    const targets = buildGenerationTargets(CWD, config);
    const paths = targets.map((t) =>
      path.relative(CWD, t.outPath).split(path.sep).join("/"),
    );
    for (const p of [
      "src/app/core/interfaces/cache.model.ts",
      "src/app/core/services/cache.ts",
      "src/app/core/services/cache-storage.ts",
      "src/app/core/tokens/api-tokens.ts",
      "src/app/core/interceptors/cache-interceptor.ts",
      "src/app/core/interceptors/auth-interceptor.ts",
      "src/app/core/guards/auth-guard.ts",
      "src/app/layout/private/private-layout.ts",
      "src/app/layout/private/private-layout.html",
      "src/app/pages/landing-page/landing-page.ts",
    ]) {
      expect(paths).toContain(p);
    }
    expect(paths.some((p) => p.includes(".component."))).toBe(false);
    const routes = targets.find((t) => t.outPath.endsWith("private.routes.ts"));
    expect(routes?.vars.LAYOUT_PRIVATE_CLASS).toBe("PrivateLayout");
    const cache = targets.find((t) =>
      t.outPath.endsWith(`services${path.sep}cache.ts`),
    );
    expect(cache?.vars.IMPORT_CACHE_STORAGE).toBe("./cache-storage");
    const barrel = targets.find((t) => t.outPath.endsWith("index.ts"));
    expect(barrel?.rawContent).toContain("export * from './cache';");
  });

  it("follows the workspace: sourceRoot, appDir and selector prefix", () => {
    const ws = {
      projectName: "admin",
      sourceRoot: "projects/admin/src",
      appDir: "projects/admin/src/app",
      prefix: "adm",
      schematics: {},
    };
    const config = {
      ...PRESETS.full,
      outputDir: "projects/admin/src/app/core",
    };
    const targets = buildGenerationTargets(CWD, config, ws);
    const paths = targets.map((t) =>
      path.relative(CWD, t.outPath).split(path.sep).join("/"),
    );
    expect(paths).toContain("projects/admin/src/environments/environment.ts");
    expect(paths).toContain("projects/admin/src/app/app.routes.ts");
    expect(paths).toContain(
      "projects/admin/src/app/layout/public/public.component.ts",
    );
    const layout = targets.find((t) =>
      t.outPath.endsWith("public.component.ts"),
    );
    expect(layout?.vars.SELECTOR).toBe("adm-public");
    const routes = targets.find((t) => t.outPath.endsWith("public.routes.ts"));
    expect(routes?.vars.IMPORT_LAYOUT_PUBLIC).toBe(
      "@layout/public/public.component",
    );
  });
});

describe("FEATURES registry", () => {
  it("presets turn on the expected features, in order", () => {
    expect(enabledFeatures(PRESETS.minimal)).toEqual([
      "environments",
      "http-core",
      "barrel",
    ]);
    expect(enabledFeatures(PRESETS.full)).toEqual([
      "environments",
      "http-core",
      "routes-tokens",
      "auth-store",
      "barrel",
      "auth-interceptor",
      "error-interceptor",
      "project-structure",
    ]);
  });

  it("feature ids are unique", () => {
    const ids = FEATURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
