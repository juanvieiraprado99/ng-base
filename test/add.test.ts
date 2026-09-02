import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runAdd } from "../src/commands/add";
import { runInit } from "../src/commands/init";
import { planArtifactFiles } from "../src/lib/artifact-plan";
import { readManifest } from "../src/lib/manifest";

let dir: string;

async function scaffold(angularVersion: string): Promise<void> {
  await fse.outputJson(path.join(dir, "package.json"), {
    name: "demo",
    dependencies: { "@angular/core": angularVersion },
  });
  await fse.outputJson(
    path.join(dir, "angular.json"),
    {
      version: 1,
      projects: {
        demo: {
          projectType: "application",
          architect: {
            build: { builder: "@angular/build:application", options: {} },
            test: { builder: "@angular/build:unit-test" },
          },
        },
      },
    },
    { spaces: 2 },
  );
  await runInit(dir, { preset: "minimal" });
}

beforeEach(async () => {
  dir = await fse.mkdtemp(path.join(os.tmpdir(), "ngx-add-"));
});
afterEach(async () => {
  await fse.remove(dir);
  process.exitCode = 0;
});

function exists(rel: string): Promise<boolean> {
  return fse.pathExists(path.join(dir, rel));
}

describe("runAdd on Angular 22", () => {
  beforeEach(async () => {
    await scaffold("^22.0.1");
  });

  it("uses v20 filenames and emits a Vitest spec", async () => {
    await runAdd("user-profile", "store", dir);

    expect(await exists("src/app/core/stores/user-profile-store.ts")).toBe(
      true,
    );
    const spec = await fse.readFile(
      path.join(dir, "src/app/core/stores/user-profile-store.spec.ts"),
      "utf8",
    );
    expect(spec).toContain("from 'vitest'");
    expect(spec).toContain("./user-profile-store");
  });

  it("--skip-tests omits the spec", async () => {
    await runAdd("cart", "store", dir, { skipTests: true });

    expect(await exists("src/app/core/stores/cart-store.ts")).toBe(true);
    expect(await exists("src/app/core/stores/cart-store.spec.ts")).toBe(false);
  });

  it("records every written file in the manifest", async () => {
    await runAdd("user-card", "component", dir);

    const keys = Object.keys((await readManifest(dir)).files);
    expect(keys).toEqual(
      expect.arrayContaining([
        "src/app/core/components/user-card/user-card.ts",
        "src/app/core/components/user-card/user-card.html",
        "src/app/core/components/user-card/user-card.scss",
        "src/app/core/components/user-card/user-card.spec.ts",
      ]),
    );
  });

  it("scaffolds a Signal Forms schema", async () => {
    await runAdd("signup", "form", dir);

    const form = await fse.readFile(
      path.join(dir, "src/app/core/forms/signup-form.ts"),
      "utf8",
    );
    expect(form).toContain("@angular/forms/signals");
    expect(form).toContain("export const signupForm = schema<Signup>");
  });
});

describe("runAdd on Angular 19", () => {
  beforeEach(async () => {
    await scaffold("^19.2.0");
  });

  it("keeps classic filenames", async () => {
    await runAdd("auth", "guard", dir);
    expect(await exists("src/app/core/guards/auth.guard.ts")).toBe(true);
  });

  it("emits Jasmine-style specs when the project runs Karma", async () => {
    const angularJsonPath = path.join(dir, "angular.json");
    const angular = await fse.readJson(angularJsonPath);
    angular.projects.demo.architect.test.builder =
      "@angular-devkit/build-angular:karma";
    await fse.writeJson(angularJsonPath, angular, { spaces: 2 });

    // Angular 19 configs default generateSpecs off; opt in explicitly.
    const configPath = path.join(dir, ".ngx-base-cli.json");
    const config = await fse.readJson(configPath);
    config.generateSpecs = true;
    await fse.writeJson(configPath, config, { spaces: 2 });

    await runAdd("auth", "guard", dir);

    const spec = await fse.readFile(
      path.join(dir, "src/app/core/guards/auth.guard.spec.ts"),
      "utf8",
    );
    expect(spec).not.toContain("from 'vitest'");
    expect(spec).toContain("describe('authGuard'");
  });

  it("refuses to scaffold a Signal Form", async () => {
    const plan = await planArtifactFiles(
      "form",
      "signup",
      dir,
      "src/app/core",
      {
        signalFormsStable: false,
      },
    );
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.error).toMatch(/Angular 22/);
  });
});
