import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectNamingStyle } from "../src/lib/naming-style";
import {
  DEFAULT_WORKSPACE,
  resolveWorkspace,
  workspaceFromAngularJson,
} from "../src/lib/workspace";

const multi = {
  projects: {
    ui: {
      projectType: "library",
      root: "projects/ui",
      sourceRoot: "projects/ui/src",
    },
    admin: {
      projectType: "application",
      root: "projects/admin",
      sourceRoot: "projects/admin/src",
      prefix: "adm",
      schematics: { "@schematics/angular:component": { style: "scss" } },
    },
    shop: { projectType: "application", root: "projects/shop", prefix: "shop" },
  },
  schematics: { "@schematics/angular:component": { type: "component" } },
};

describe("workspaceFromAngularJson", () => {
  it("picks the first application and reads sourceRoot/prefix", () => {
    const ws = workspaceFromAngularJson(multi);
    expect(ws).toMatchObject({
      projectName: "admin",
      sourceRoot: "projects/admin/src",
      appDir: "projects/admin/src/app",
      prefix: "adm",
    });
    // workspace-level and project-level schematics are merged
    expect(ws.schematics["@schematics/angular:component"]).toEqual({
      type: "component",
      style: "scss",
    });
  });

  it("honors an explicit project and derives sourceRoot from root", () => {
    const ws = workspaceFromAngularJson(multi, "shop");
    expect(ws).toMatchObject({
      projectName: "shop",
      sourceRoot: "projects/shop/src",
      appDir: "projects/shop/src/app",
      prefix: "shop",
    });
  });

  it("throws for an unknown explicit project", () => {
    expect(() => workspaceFromAngularJson(multi, "nope")).toThrow(/not found/);
  });

  it("single ng-new project at the root", () => {
    const ws = workspaceFromAngularJson({
      projects: {
        demo: {
          projectType: "application",
          root: "",
          sourceRoot: "src",
          prefix: "app",
        },
      },
    });
    expect(ws).toMatchObject({
      projectName: "demo",
      sourceRoot: "src",
      appDir: "src/app",
      prefix: "app",
    });
  });
});

let dir: string;
beforeEach(async () => {
  dir = await fse.mkdtemp(path.join(os.tmpdir(), "ngx-ws-"));
});
afterEach(async () => {
  await fse.remove(dir);
});

describe("resolveWorkspace", () => {
  it("falls back to src/app without angular.json", async () => {
    expect(await resolveWorkspace(dir)).toEqual(DEFAULT_WORKSPACE);
  });
});

describe("detectNamingStyle", () => {
  it("suffixed when angular.json schematics keep type: component", async () => {
    const res = await detectNamingStyle(
      dir,
      workspaceFromAngularJson(multi),
      22,
    );
    expect(res.style).toBe("suffixed");
  });

  it("suffixed when the project has *.component.ts files", async () => {
    await fse.outputFile(path.join(dir, "src/app/home/home.component.ts"), "");
    const res = await detectNamingStyle(dir, DEFAULT_WORKSPACE, 22);
    expect(res.style).toBe("suffixed");
  });

  it("modern when the root component is app.ts", async () => {
    await fse.outputFile(path.join(dir, "src/app/app.ts"), "");
    const res = await detectNamingStyle(dir, DEFAULT_WORKSPACE, 19);
    expect(res.style).toBe("modern");
  });

  it("falls back to the Angular major", async () => {
    expect((await detectNamingStyle(dir, DEFAULT_WORKSPACE, 20)).style).toBe(
      "modern",
    );
    expect((await detectNamingStyle(dir, DEFAULT_WORKSPACE, 19)).style).toBe(
      "suffixed",
    );
    expect((await detectNamingStyle(dir, DEFAULT_WORKSPACE, null)).style).toBe(
      "suffixed",
    );
  });
});
