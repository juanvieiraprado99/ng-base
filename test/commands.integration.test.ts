import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAdd } from "../src/commands/add";
import { runDoctor } from "../src/commands/doctor";
import { runInit } from "../src/commands/init";
import { runList } from "../src/commands/list";
import { runUpdate } from "../src/commands/update";
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
  dir = await fse.mkdtemp(path.join(os.tmpdir(), "ngx-it-"));
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

describe("init --preset full --yes on an Angular 22 app", () => {
  it("generates the full core, patches the project, and is stable", async () => {
    await runInit(dir, { yes: true, preset: "full" });
    expect(process.exitCode).toBeUndefined();

    const tree = await snapshotTree(dir);
    // Generated file list (modern naming: suffixless app.ts was detected).
    expect(Object.keys(tree)).toMatchSnapshot();

    const config = JSON.parse(tree[".ngx-base-cli.json"] ?? "{}");
    expect(config.$schema).toBe(CONFIG_SCHEMA_URL);
    expect(config.naming).toBe("modern");
    expect(config.project).toBe("demo");

    // app.config: HTTP providers with every interceptor, cache last.
    expect(tree["src/app/app.config.ts"]).toMatch(
      /provideHttpClient\(\s*withInterceptors\(\[\s*authInterceptor,\s*errorInterceptor,\s*cacheInterceptor,?\s*\]\)/,
    );
    // app.routes: merged, not overwritten; app.html kept (createOnly).
    expect(tree["src/app/app.routes.ts"]).toContain("...PUBLIC_ROUTES");
    expect(tree["src/app/app.routes.ts"]).toContain("...PRIVATE_ROUTES");
    expect(tree["src/app/app.html"]).toBe("<h1>demo</h1>\n");
    // tsconfig: aliases added, comment kept, no baseUrl.
    expect(tree["tsconfig.json"]).toContain(
      "/* To learn more about Typescript",
    );
    expect(tree["tsconfig.json"]).not.toContain("baseUrl");
    const tsconfig = parseJsonWithComments(tree["tsconfig.json"] ?? "") as {
      compilerOptions: { paths: Record<string, string[]> };
    };
    expect(tsconfig.compilerOptions.paths["@core/*"]).toEqual([
      "./src/app/core/*",
    ]);
    // angular.json: prod environment swap.
    expect(tree["angular.json"]).toContain(
      '"with": "src/environments/environment.prod.ts"',
    );
    // Selector prefix from angular.json.
    expect(tree["src/app/layout/private/private-layout.ts"]).toContain(
      "selector: 'app-private-layout'",
    );

    // update right after init: nothing changes.
    await runUpdate(dir, true);
    expect(process.exitCode).toBeUndefined();
    expect(await snapshotTree(dir)).toEqual(tree);

    await runList(dir);
    expect(process.exitCode).toBeUndefined();
    await runDoctor(dir);
    expect(process.exitCode).toBeUndefined();
  });

  it("keeps `add` artifacts in the manifest across a re-init", async () => {
    await runInit(dir, { yes: true, preset: "full" });
    await runAdd("user", "service", dir);
    expect(
      await fse.pathExists(path.join(dir, "src/app/core/services/user.ts")),
    ).toBe(true);
    const userService = await fse.readFile(
      path.join(dir, "src/app/core/services/user.ts"),
      "utf8",
    );
    expect(userService).toContain("export class UserService");
    expect(userService).toContain("inject(ApiClient)");

    await runInit(dir, { yes: true, preset: "full" });
    const manifest = await fse.readJson(
      path.join(dir, ".ngx-base-cli.manifest.json"),
    );
    expect(Object.keys(manifest.files)).toContain(
      "src/app/core/services/user.ts",
    );
    expect(Object.keys(manifest.files)).toContain(
      "src/app/core/services/api-client.ts",
    );
  });

  it("--naming suffixed and --no-tsconfig fall back to relative imports", async () => {
    await runInit(dir, {
      yes: true,
      preset: "standard",
      naming: "suffixed",
      tsconfig: false,
    });
    expect(process.exitCode).toBeUndefined();
    const tree = await snapshotTree(dir);
    expect(tree["tsconfig.json"]).toBe(TSCONFIG);
    expect(JSON.parse(tree[".ngx-base-cli.json"] ?? "{}").importStyle).toBe(
      "relative",
    );
    expect(tree["src/app/core/services/cache.service.ts"]).toBeDefined();
    expect(tree["src/app/app.config.ts"]).toContain(
      "from './core/interceptors/auth.interceptor'",
    );
  });
});
