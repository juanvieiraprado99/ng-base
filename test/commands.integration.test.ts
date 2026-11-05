import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAdd } from "../src/commands/add";
import { runDoctor } from "../src/commands/doctor";
import { runGenerate } from "../src/commands/generate";
import { runInit } from "../src/commands/init";
import { runList } from "../src/commands/list";
import { CONFIG_SCHEMA_URL } from "../src/lib/config";
import { parseJsonWithComments } from "../src/lib/parse-jsonc";

/**
 * End-to-end over the command functions on a minimal `ng new`-shaped fixture
 * (no node_modules, so no `ng build` — CI's e2e job covers that).
 */

const TSCONFIG = `/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
{
  "compileOnSave": false,
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "preserve"
  }
}
`;

const APP_CONFIG = `import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes)
  ]
};
`;

async function writeFixture(dir: string): Promise<void> {
  await fse.outputJson(path.join(dir, "package.json"), {
    name: "demo",
    dependencies: { "@angular/core": "^22.0.0" },
  });
  await fse.outputFile(
    path.join(dir, "angular.json"),
    `${JSON.stringify(
      {
        version: 1,
        projects: {
          demo: {
            projectType: "application",
            root: "",
            sourceRoot: "src",
            prefix: "app",
            architect: {
              build: {
                builder: "@angular/build:application",
                configurations: { production: {}, development: {} },
              },
            },
          },
        },
      },
      null,
      2,
    )}\n`,
  );
  await fse.outputFile(path.join(dir, "tsconfig.json"), TSCONFIG);
  await fse.outputFile(path.join(dir, "src/app/app.config.ts"), APP_CONFIG);
  await fse.outputFile(
    path.join(dir, "src/app/app.routes.ts"),
    "import { Routes } from '@angular/router';\n\nexport const routes: Routes = [];\n",
  );
  await fse.outputFile(
    path.join(dir, "src/app/app.ts"),
    "export class App {}\n",
  );
  await fse.outputFile(path.join(dir, "src/app/app.html"), "<h1>demo</h1>\n");
}

/** relative path → content for every file under dir (posix paths, sorted). */
async function snapshotTree(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const walk = async (d: string) => {
    for (const e of await fse.readdir(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else
        out[path.relative(dir, full).split(path.sep).join("/")] =
          await fse.readFile(full, "utf8");
    }
  };
  await walk(dir);
  return Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => a.localeCompare(b)),
  );
}

let dir: string;
beforeEach(async () => {
  dir = await fse.mkdtemp(path.join(os.tmpdir(), "ng-base-it-"));
  await writeFixture(dir);
  // clack writes straight to stdout; keep the test output readable.
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  process.exitCode = undefined;
});
afterEach(async () => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
  await fse.remove(dir);
});

const read = (file: string) => fse.readFile(path.join(dir, file), "utf8");
const exists = (file: string) => fse.pathExists(path.join(dir, file));
const config = async () => fse.readJson(path.join(dir, ".ngx-base-cli.json"));
const tsPaths = (raw: string | undefined) =>
  Object.keys(
    (
      parseJsonWithComments(raw ?? "") as {
        compilerOptions: { paths: Record<string, string[]> };
      }
    ).compilerOptions.paths,
  );

describe("init → add on an Angular 22 app", () => {
  it("init installs only the core and patches the project", async () => {
    await runInit(dir, { yes: true });
    expect(process.exitCode).toBeUndefined();

    const tree = await snapshotTree(dir);
    expect(Object.keys(tree)).toMatchSnapshot();

    const cfg = JSON.parse(tree[".ngx-base-cli.json"] ?? "{}");
    expect(cfg.$schema).toBe(CONFIG_SCHEMA_URL);
    expect(cfg.naming).toBe("modern");
    expect(cfg.project).toBe("demo");
    expect(cfg.modules).toEqual([]);
    expect(cfg.useHttpResource).toBe(true);

    expect(tree["src/app/app.config.ts"]).toMatch(
      /provideHttpClient\(\s*withInterceptors\(\[\s*cacheInterceptor,?\s*\]\)/,
    );
    // tsconfig: only @core, comment kept, no baseUrl.
    expect(tree["tsconfig.json"]).toContain(
      "/* To learn more about Typescript",
    );
    expect(tree["tsconfig.json"]).not.toContain("baseUrl");
    expect(tsPaths(tree["tsconfig.json"])).toEqual(["@core/*"]);
    expect(tree["angular.json"]).toContain(
      '"with": "src/environments/environment.prod.ts"',
    );
    // No sync artifacts any more.
    expect(tree[".ngx-base-cli.manifest.json"]).toBeUndefined();
    expect(tree["src/app/core/services/index.ts"]).toBeUndefined();
  });

  it("add layout logging errors auth wires everything up", async () => {
    await runInit(dir, { yes: true });
    await runAdd(["layout", "logging", "errors", "auth"], dir, { yes: true });
    expect(process.exitCode).toBeUndefined();

    const tree = await snapshotTree(dir);
    expect(Object.keys(tree)).toMatchSnapshot();
    expect((await config()).modules).toEqual([
      "auth",
      "errors",
      "logging",
      "layout",
    ]);
    expect(tree["src/app/app.config.ts"]).toMatch(
      /withInterceptors\(\[\s*authInterceptor,\s*errorInterceptor,\s*loggingInterceptor,\s*cacheInterceptor,?\s*\]\)/,
    );
    expect(tree["src/app/app.routes.ts"]).toContain("...PUBLIC_ROUTES");
    expect(tree["src/app/app.routes.ts"]).toContain("...PRIVATE_ROUTES");
    expect(tree["src/app/app.html"]).toBe("<h1>demo</h1>\n");
    expect(tree["src/app/routes/private.routes.ts"]).toContain(
      "canMatch: [authGuard]",
    );
    expect(tree["src/app/layout/private/private-layout.ts"]).toContain(
      "selector: 'app-private-layout'",
    );
    expect(tsPaths(tree["tsconfig.json"])).toEqual([
      "@core/*",
      "@layout/*",
      "@pages/*",
      "@shared/*",
    ]);

    await runList(dir);
    await runDoctor(dir);
    expect(process.exitCode).toBeUndefined();
  });

  it("layout before auth: unguarded route, auth later never rewrites it", async () => {
    await runInit(dir, { yes: true });
    await runAdd(["layout"], dir, { yes: true });
    const routes = await read("src/app/routes/private.routes.ts");
    expect(routes).not.toMatch(/^\s*canMatch/m);
    await runAdd(["auth"], dir, { yes: true });
    expect(await read("src/app/routes/private.routes.ts")).toBe(routes);
    expect(await exists("src/app/core/guards/auth-guard.ts")).toBe(true);
    expect(await read("src/app/app.config.ts")).toMatch(
      /withInterceptors\(\[\s*authInterceptor,\s*cacheInterceptor/,
    );
  });

  it("the code is the user's: edits survive re-adds and re-inits", async () => {
    await runInit(dir, { yes: true, with: "errors" });
    const file = "src/app/core/interceptors/error-interceptor.ts";
    const client = "src/app/core/services/api-client.ts";
    await fse.writeFile(path.join(dir, file), "// mine\n");
    await fse.writeFile(path.join(dir, client), "// mine too\n");

    await runAdd(["errors"], dir, { yes: true }); // already installed: no-op
    await runInit(dir, { yes: true });
    expect(await read(file)).toBe("// mine\n");
    expect(await read(client)).toBe("// mine too\n");
    expect((await config()).modules).toEqual(["errors"]);

    await runAdd(["errors"], dir, { yes: true, overwrite: true });
    expect(await read(file)).not.toBe("// mine\n");
  });

  it("generate service writes an ApiClient-based service", async () => {
    await runInit(dir, { yes: true });
    await runGenerate("service", "user", dir, { endpoint: "users" });
    const svc = await read("src/app/core/services/user.ts");
    expect(svc).toContain("export class UserService");
    expect(svc).toContain("inject(ApiClient)");
    expect(svc).toContain('private readonly endpoint = "/users";');

    await runGenerate("component", "user", dir);
    expect(process.exitCode).toBe(1);
  });

  it("--naming suffixed and --no-tsconfig fall back to relative imports", async () => {
    await runInit(dir, {
      yes: true,
      with: "auth",
      naming: "suffixed",
      tsconfig: false,
      storage: "memory",
    });
    expect(process.exitCode).toBeUndefined();
    expect(await read("tsconfig.json")).toBe(TSCONFIG);
    const cfg = await config();
    expect(cfg.importStyle).toBe("relative");
    expect(cfg.storageEngine).toBe("memory");
    expect(await read("src/app/app.config.ts")).toContain(
      "from './core/interceptors/auth.interceptor'",
    );
    expect(await read("src/app/core/services/cache.storage.ts")).toContain(
      "memoryStorage()",
    );
  });

  it("migrates a 0.1 .ngx-base-cli.json in place on the next command", async () => {
    await fse.writeJson(path.join(dir, ".ngx-base-cli.json"), {
      outputDir: "src/app/core",
      naming: "modern",
      generateAuthInterceptor: true,
      generateBarrel: true,
    });
    await runList(dir);
    expect((await config()).modules).toEqual(["auth"]);
    expect(await config()).not.toHaveProperty("generateBarrel");
  });

  it("rejects unknown modules", async () => {
    await runInit(dir, { yes: true, with: "auth,charts" });
    expect(process.exitCode).toBe(1);
    expect(await exists(".ngx-base-cli.json")).toBe(false);
  });
});
