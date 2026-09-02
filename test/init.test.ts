import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runAdd } from "../src/commands/add";
import { runInit } from "../src/commands/init";
import { readNgxBaseConfig } from "../src/lib/config";
import { classifyTarget, readManifest, sha256 } from "../src/lib/manifest";

let dir: string;

const TSCONFIG_WITH_COMMENTS = `{
  /* Learn more: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html */
  "compilerOptions": {
    // Strictness flags recommended by the Angular team
    "strict": true,
    "target": "ES2022"
  },
  "angularCompilerOptions": {
    "strictTemplates": true
  }
}
`;

function angularJson(): unknown {
  return {
    version: 1,
    projects: {
      demo: {
        projectType: "application",
        architect: {
          build: {
            builder: "@angular/build:application",
            options: {},
            configurations: { production: {}, development: {} },
          },
          test: { builder: "@angular/build:unit-test" },
        },
      },
    },
  };
}

async function scaffoldProject(angularVersion: string): Promise<void> {
  await fse.outputJson(path.join(dir, "package.json"), {
    name: "demo",
    dependencies: { "@angular/core": angularVersion },
  });
  await fse.writeFile(path.join(dir, "tsconfig.json"), TSCONFIG_WITH_COMMENTS);
  await fse.outputJson(path.join(dir, "angular.json"), angularJson(), {
    spaces: 2,
  });
  await fse.outputFile(
    path.join(dir, "src/app/app.config.ts"),
    [
      "import { ApplicationConfig } from '@angular/core';",
      "",
      "export const appConfig: ApplicationConfig = {",
      "  providers: [],",
      "};",
      "",
    ].join("\n"),
  );
}

function read(rel: string): Promise<string> {
  return fse.readFile(path.join(dir, rel), "utf8");
}

beforeEach(async () => {
  dir = await fse.mkdtemp(path.join(os.tmpdir(), "ngx-init-"));
});
afterEach(async () => {
  await fse.remove(dir);
  process.exitCode = 0;
});

describe("runInit on an Angular 22 project", () => {
  beforeEach(async () => {
    await scaffoldProject("^22.0.1");
  });

  it("records the detected capabilities in the config", async () => {
    await runInit(dir, { preset: "minimal" });

    const config = await readNgxBaseConfig(dir);
    expect(config).toMatchObject({
      angularTarget: 22,
      fileNaming: "v20",
      environmentStyle: "development",
      useHttpResource: true,
      generateSpecs: true,
    });
  });

  it("omits the redundant OnPush field and uses @Service", async () => {
    await runInit(dir, { preset: "full" });

    const landing = await read(
      "src/app/pages/landing-page/landing-page.component.ts",
    );
    expect(landing).not.toContain("ChangeDetectionStrategy");
    expect(await read("src/app/core/services/cache.service.ts")).toContain(
      "@Service()",
    );
  });

  it("patches angular.json development fileReplacements", async () => {
    await runInit(dir, { preset: "minimal" });

    const angular = JSON.parse(await read("angular.json"));
    expect(
      angular.projects.demo.architect.build.configurations.development
        .fileReplacements,
    ).toEqual([
      {
        replace: "src/environments/environment.ts",
        with: "src/environments/environment.development.ts",
      },
    ]);
    expect(
      await fse.pathExists(
        path.join(dir, "src/environments/environment.development.ts"),
      ),
    ).toBe(true);
  });

  it("adds tsconfig aliases without destroying comments", async () => {
    await runInit(dir, { preset: "minimal" });

    const tsconfig = await read("tsconfig.json");
    expect(tsconfig).toContain(
      "// Strictness flags recommended by the Angular team",
    );
    expect(tsconfig).toContain("/* Learn more:");
    expect(tsconfig).toContain('"@core/*"');
    expect(
      JSON.parse(tsconfig.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")),
    ).toHaveProperty("compilerOptions.paths");
  });

  it("keeps manifest entries written by add when init runs again", async () => {
    await runInit(dir, { preset: "minimal" });
    await runAdd("user-profile", "service", dir);

    const key = "src/app/core/services/user-profile.ts";
    expect((await readManifest(dir)).files[key]).toBeDefined();

    await runInit(dir, { preset: "minimal" });

    expect((await readManifest(dir)).files[key]).toBeDefined();
  });

  it("marks a pre-existing file it did not overwrite as locally edited", async () => {
    const target = path.join(dir, "src/app/core/services/base.service.ts");
    await fse.outputFile(target, "// hand-written, do not touch\n");

    await runInit(dir, { preset: "minimal" });

    // The file was left alone...
    expect(await fse.readFile(target, "utf8")).toBe(
      "// hand-written, do not touch\n",
    );
    // ...and the manifest entry makes `update` treat it as an edit, not drift.
    const manifest = await readManifest(dir);
    const entry = manifest.files["src/app/core/services/base.service.ts"];
    expect(entry).toBeDefined();
    expect(
      classifyTarget(
        "// hand-written, do not touch\n",
        "rendered output differs",
        entry?.hash,
      ),
    ).toBe("edited");
  });

  it("dry-run writes nothing", async () => {
    await runInit(dir, { preset: "full", dryRun: true });

    expect(await fse.pathExists(path.join(dir, "src/app/core"))).toBe(false);
    expect(await fse.pathExists(path.join(dir, ".ngx-base-cli.json"))).toBe(
      false,
    );
  });
});

describe("runInit on an Angular 19 project", () => {
  beforeEach(async () => {
    await scaffoldProject("^19.2.0");
  });

  it("keeps classic naming, explicit OnPush and @Injectable", async () => {
    await runInit(dir, { preset: "full" });

    const config = await readNgxBaseConfig(dir);
    expect(config).toMatchObject({ angularTarget: 19, fileNaming: "classic" });

    const landing = await read(
      "src/app/pages/landing-page/landing-page.component.ts",
    );
    expect(landing).toContain("ChangeDetectionStrategy.OnPush");
    expect(await read("src/app/core/services/base.service.ts")).toContain(
      "@Injectable({ providedIn: 'root' })",
    );
  });

  it("does not default to httpResource before it is stable", async () => {
    await runInit(dir, { preset: "minimal" });
    expect((await readNgxBaseConfig(dir))?.useHttpResource).toBe(false);
  });
});

describe("generated content", () => {
  beforeEach(async () => {
    await scaffoldProject("^22.0.1");
  });

  it("caches by url plus params and unwraps falsy hits", async () => {
    // The Observable-based BaseService — Angular 22 defaults to httpResource.
    await scaffoldProject("^19.2.0");
    await runInit(dir, { preset: "minimal" });
    const baseService = await read("src/app/core/services/base.service.ts");

    expect(baseService).toContain("cacheKey(url, params)");
    expect(baseService).toContain("params?.toString()");
    // A wrapper object, so a cached 0 / "" / false is still a hit.
    expect(baseService).toContain("if (cached) {");
    expect(baseService).toContain("of(cached.value)");
  });

  it("no longer base64-encodes cache keys or values", async () => {
    await runInit(dir, { preset: "minimal" });
    const cacheService = await read("src/app/core/services/cache.service.ts");

    expect(cacheService).not.toContain("btoa");
    expect(cacheService).not.toContain("atob");
    expect(cacheService).toContain("startsWith(this.baseUrl)");
  });

  it("restricts the auth token to the project's own API", async () => {
    await runInit(dir, { preset: "standard" });
    const interceptor = await read(
      "src/app/core/interceptors/auth.interceptor.ts",
    );

    expect(interceptor).toContain("isOwnApi(req.url, baseApiUrl)");
    expect(interceptor).toContain("const token = getToken();");
  });

  it("hashes match what the manifest recorded", async () => {
    await runInit(dir, { preset: "minimal" });
    const manifest = await readManifest(dir);

    for (const [rel, entry] of Object.entries(manifest.files)) {
      const disk = await fse.readFile(path.join(dir, rel), "utf8");
      expect(sha256(disk), rel).toBe(entry.hash);
    }
  });
});
