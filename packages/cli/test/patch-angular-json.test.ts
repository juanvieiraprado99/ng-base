import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { patchAngularJsonFileReplacements } from "../src/lib/patch-angular-json";

let dir: string;

beforeEach(async () => {
  dir = await fse.mkdtemp(path.join(os.tmpdir(), "ngx-ngjson-"));
});
afterEach(async () => {
  await fse.remove(dir);
});

function baseAngularJson() {
  return {
    version: 1,
    projects: {
      app: {
        projectType: "application",
        architect: {
          build: {
            builder: "@angular-devkit/build-angular:application",
            options: {},
            configurations: { production: {} },
          },
        },
      },
    },
  };
}

async function writeAngularJson(obj: unknown): Promise<string> {
  const p = path.join(dir, "angular.json");
  await fse.writeFile(p, JSON.stringify(obj, null, 2));
  return p;
}

describe("patchAngularJsonFileReplacements", () => {
  it("returns ok:false when angular.json is missing", async () => {
    expect(await patchAngularJsonFileReplacements(dir)).toEqual({ ok: false });
  });

  it("adds production fileReplacements", async () => {
    const p = await writeAngularJson(baseAngularJson());
    const res = await patchAngularJsonFileReplacements(dir);
    expect(res).toEqual({ ok: true, mutated: true });
    const json = JSON.parse(await fse.readFile(p, "utf8"));
    expect(
      json.projects.app.architect.build.configurations.production
        .fileReplacements,
    ).toEqual([
      {
        replace: "src/environments/environment.ts",
        with: "src/environments/environment.prod.ts",
      },
    ]);
  });

  it("is idempotent (second run does not mutate)", async () => {
    await writeAngularJson(baseAngularJson());
    await patchAngularJsonFileReplacements(dir);
    const res = await patchAngularJsonFileReplacements(dir);
    expect(res).toEqual({ ok: true, mutated: false });
  });

  it("preserves comments and appends to existing replacements (targets key)", async () => {
    const p = path.join(dir, "angular.json");
    await fse.writeFile(
      p,
      `{
  // workspace comment
  "version": 1,
  "projects": {
    "app": {
      "projectType": "application",
      "targets": {
        "build": {
          "configurations": {
            "production": {
              "fileReplacements": [
                { "replace": "src/a.ts", "with": "src/a.prod.ts" }
              ]
            }
          }
        }
      }
    }
  }
}
`,
    );
    const res = await patchAngularJsonFileReplacements(dir);
    expect(res).toEqual({ ok: true, mutated: true });
    const out = await fse.readFile(p, "utf8");
    expect(out).toContain("// workspace comment");
    expect(out).toContain('"replace": "src/a.ts"');
    expect(out).toContain("src/environments/environment.prod.ts");
    expect(await patchAngularJsonFileReplacements(dir)).toEqual({
      ok: true,
      mutated: false,
    });
  });
});
