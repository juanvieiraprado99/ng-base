import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  MODULE_IDS,
  type ModuleId,
  type NgBaseConfig,
} from "../src/lib/config";
import {
  buildModuleTargets,
  type InstallId,
  interceptorBindings,
  MODULES,
  pathAliases,
  sortIds,
  withModules,
} from "../src/lib/modules";
import { renderGenerationTarget } from "../src/lib/render-target";

const CWD = "/proj";
const rel = (t: { outPath: string }) =>
  path.relative(CWD, t.outPath).split(path.sep).join("/");

function paths(ids: InstallId[], config: NgBaseConfig = DEFAULT_CONFIG) {
  return buildModuleTargets(CWD, config, undefined, ids).map(rel);
}

describe("MODULES registry", () => {
  it("has the core plus every MODULE_ID, unique, core first", () => {
    const ids = MODULES.map((m) => m.id);
    expect(ids).toEqual(["core", ...MODULE_IDS]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sortIds puts ids in registry order and drops duplicates", () => {
    expect(sortIds(["layout", "auth", "core", "auth"])).toEqual([
      "core",
      "auth",
      "layout",
    ]);
  });

  it("withModules merges in canonical order", () => {
    const cfg = withModules({ ...DEFAULT_CONFIG, modules: ["layout"] }, [
      "logging",
      "auth",
    ]);
    expect(cfg.modules).toEqual(["auth", "logging", "layout"]);
  });
});

describe("module targets", () => {
  it("core: api client, cache, tokens, envs, cache interceptor — no barrel, no auth", () => {
    const p = paths(["core"]);
    expect(p).toEqual([
      "src/environments/environment.ts",
      "src/environments/environment.prod.ts",
      "src/app/core/interfaces/cache.interface.ts",
      "src/app/core/tokens/api.tokens.ts",
      "src/app/core/services/cache.storage.ts",
      "src/app/core/services/cache.service.ts",
      "src/app/core/services/api-client.ts",
      "src/app/core/interceptors/cache.interceptor.ts",
    ]);
  });

  it("auth: tokens, store, interceptor and guard", () => {
    expect(paths(["auth"])).toEqual([
      "src/app/core/tokens/auth.tokens.ts",
      "src/app/core/services/auth-token.store.ts",
      "src/app/core/interceptors/auth.interceptor.ts",
      "src/app/core/guards/auth.guard.ts",
    ]);
  });

  it("errors and logging: one interceptor file each", () => {
    expect(paths(["errors"])).toEqual([
      "src/app/core/interceptors/error.interceptor.ts",
    ]);
    expect(paths(["logging"])).toEqual([
      "src/app/core/interceptors/logging.interceptor.ts",
    ]);
  });

  it("layout: components + routes; app.routes.ts / app.html are create-only", () => {
    const targets = buildModuleTargets(CWD, DEFAULT_CONFIG, undefined, [
      "layout",
    ]);
    expect(targets.map(rel)).toContain("src/app/routes/private.routes.ts");
    expect(targets.map(rel)).toContain(
      "src/app/layout/private/private.component.ts",
    );
    expect(targets.filter((t) => t.createOnly).map(rel)).toEqual([
      "src/app/app.routes.ts",
      "src/app/app.html",
    ]);
  });

  it("layout guards the private route only when auth is installed", () => {
    const guard = (config: NgBaseConfig, ids: InstallId[]) =>
      buildModuleTargets(CWD, config, undefined, ids).find((t) =>
        t.outPath.endsWith("private.routes.ts"),
      )?.vars.GUARD;
    expect(guard(DEFAULT_CONFIG, ["layout"])).toBe("false");
    expect(guard(DEFAULT_CONFIG, ["auth", "layout"])).toBe("true");
    expect(guard({ ...DEFAULT_CONFIG, modules: ["auth"] }, ["layout"])).toBe(
      "true",
    );
  });

  it("core vars follow httpResource and storage settings", () => {
    const vars = (config: Partial<NgBaseConfig>, file: string) =>
      buildModuleTargets(CWD, { ...DEFAULT_CONFIG, ...config }, undefined, [
        "core",
      ]).find((t) => t.outPath.endsWith(file))?.vars;
    expect(
      vars({ useHttpResource: true }, "api-client.ts")?.HTTP_RESOURCE,
    ).toBe("true");
    expect(
      vars({ storageEngine: "memory" }, "cache.storage.ts")?.STORAGE_FACTORY,
    ).toBe("memoryStorage()");
  });

  it("route imports follow importStyle", () => {
    const find = (config: NgBaseConfig) =>
      buildModuleTargets(CWD, config, undefined, ["auth", "layout"]).find((t) =>
        t.outPath.endsWith("private.routes.ts"),
      )?.vars;
    expect(find(DEFAULT_CONFIG)?.IMPORT_LAYOUT_PRIVATE).toBe(
      "@layout/private/private.component",
    );
    expect(find(DEFAULT_CONFIG)?.IMPORT_AUTH_GUARD).toBe(
      "@core/guards/auth.guard",
    );
    const relative = find({ ...DEFAULT_CONFIG, importStyle: "relative" });
    expect(relative?.IMPORT_LAYOUT_PRIVATE).toBe(
      "../layout/private/private.component",
    );
    expect(relative?.IMPORT_AUTH_GUARD).toBe("../core/guards/auth.guard");
  });

  it("modern naming: suffixless files and class names", () => {
    const config = { ...DEFAULT_CONFIG, naming: "modern" as const };
    const all: InstallId[] = ["core", ...MODULE_IDS];
    const p = paths(all, config);
    for (const f of [
      "src/app/core/interfaces/cache.model.ts",
      "src/app/core/services/cache.ts",
      "src/app/core/tokens/api-tokens.ts",
      "src/app/core/interceptors/auth-interceptor.ts",
      "src/app/core/guards/auth-guard.ts",
      "src/app/layout/private/private-layout.ts",
      "src/app/pages/landing-page/landing-page.ts",
    ]) {
      expect(p).toContain(f);
    }
    expect(p.some((f) => f.includes(".component."))).toBe(false);
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
      ...DEFAULT_CONFIG,
      outputDir: "projects/admin/src/app/core",
    };
    const targets = buildModuleTargets(CWD, config, ws, ["core", "layout"]);
    expect(targets.map(rel)).toContain(
      "projects/admin/src/environments/environment.ts",
    );
    const layout = targets.find((t) =>
      t.outPath.endsWith("public.component.ts"),
    );
    expect(layout?.vars.SELECTOR).toBe("adm-public");
    expect(pathAliases(config, ws, ["core", "layout"])["@layout"]).toBe(
      "projects/admin/src/app/layout",
    );
  });
});

describe("independence", () => {
  const subsets = (ids: readonly ModuleId[]): ModuleId[][] => {
    const out: ModuleId[][] = [[]];
    for (const id of ids) {
      for (const s of out.slice()) out.push([...s, id]);
    }
    return out;
  };

  it("every module subset × naming × importStyle renders with no leftover tokens", async () => {
    for (const modules of subsets(MODULE_IDS)) {
      for (const naming of ["suffixed", "modern"] as const) {
        for (const importStyle of ["alias", "relative"] as const) {
          const config = {
            ...DEFAULT_CONFIG,
            naming,
            importStyle,
            useHttpResource: true,
            modules,
          };
          for (const t of buildModuleTargets(CWD, config)) {
            expect(await renderGenerationTarget(t)).not.toMatch(
              /\{\{[#/A-Z0-9_ ]+\}\}/,
            );
          }
        }
      }
    }
  });

  it("a module only imports from the core and itself", async () => {
    const all = { ...DEFAULT_CONFIG, modules: [...MODULE_IDS] };
    const owner = new Map<string, InstallId>();
    for (const m of MODULES) {
      for (const t of buildModuleTargets(CWD, all, undefined, [m.id])) {
        owner.set(t.outPath.replace(/\.ts$/, ""), m.id);
      }
    }
    for (const m of MODULES) {
      for (const t of buildModuleTargets(CWD, all, undefined, [m.id])) {
        if (!t.outPath.endsWith(".ts")) continue;
        const source = await renderGenerationTarget(t);
        const sf = ts.createSourceFile(
          t.outPath,
          source,
          ts.ScriptTarget.ES2022,
        );
        const specs: string[] = [];
        sf.forEachChild((n) => {
          if (
            ts.isImportDeclaration(n) &&
            ts.isStringLiteral(n.moduleSpecifier)
          )
            specs.push(n.moduleSpecifier.text);
        });
        // dynamic import() of layout components stays within layout
        for (const s of specs.filter(
          (s) => s.startsWith(".") || s.startsWith("@"),
        )) {
          if (s.startsWith("@angular") || s === "rxjs") continue;
          const abs = s.startsWith(".")
            ? path.join(path.dirname(t.outPath), s)
            : path.join(
                CWD,
                pathAliases(all)[s.split("/")[0] as string] ?? "",
                s.split("/").slice(1).join("/"),
              );
          const from = owner.get(abs);
          if (from === undefined) continue;
          // layout's private routes import authGuard only when auth is installed
          const allowed =
            from === "core" ||
            from === m.id ||
            (m.id === "layout" && from === "auth");
          expect(allowed, `${rel(t)} imports ${s} (${from})`).toBe(true);
        }
      }
    }
  });
});

describe("interceptorBindings", () => {
  it("cache only for the core", () => {
    expect(interceptorBindings(DEFAULT_CONFIG).map((b) => b.name)).toEqual([
      "cacheInterceptor",
    ]);
  });

  it("canonical order regardless of install order, cache last", () => {
    const cfg = { ...DEFAULT_CONFIG, modules: ["logging", "errors", "auth"] };
    expect(interceptorBindings(cfg as NgBaseConfig).map((b) => b.name)).toEqual(
      [
        "authInterceptor",
        "errorInterceptor",
        "loggingInterceptor",
        "cacheInterceptor",
      ],
    );
  });

  it("layout adds the structural aliases", () => {
    expect(Object.keys(pathAliases(DEFAULT_CONFIG))).toEqual(["@core"]);
    expect(
      Object.keys(pathAliases({ ...DEFAULT_CONFIG, modules: ["layout"] })),
    ).toEqual(["@core", "@layout", "@pages", "@shared"]);
  });
});

describe("templates", () => {
  const render = async (template: string, modules: ModuleId[]) => {
    const t = buildModuleTargets(CWD, { ...DEFAULT_CONFIG, modules }).find(
      (x) => x.template === template,
    );
    if (!t) throw new Error(`${template} not planned`);
    return renderGenerationTarget(t);
  };

  it("auth interceptor ends the session on a 401 of an authenticated request", async () => {
    const out = await render("auth.interceptor.ts.tpl", ["auth"]);
    expect(out).toContain("error.status === 401");
    expect(out).toContain("tokenStore.clear();");
    expect(out).toContain("LOGIN_ROUTE");
  });

  it("error interceptor has no auth dependency and no 401 handling", async () => {
    const out = await render("error.interceptor.ts.tpl", ["errors"]);
    expect(out).not.toContain("AuthTokenStore");
    expect(out).not.toContain("status === 401");
    expect(out).toContain("export const FORBIDDEN_ROUTE");
  });

  it("private routes without auth carry a TODO instead of the guard", async () => {
    const out = await render("routes-private.routes.ts.tpl", ["layout"]);
    expect(out).not.toContain("import { authGuard }");
    expect(out).not.toMatch(/^\s*canMatch/m);
    expect(out).toContain("// TODO");
    const guarded = await render("routes-private.routes.ts.tpl", [
      "auth",
      "layout",
    ]);
    expect(guarded).toContain("canMatch: [authGuard]");
  });
});
