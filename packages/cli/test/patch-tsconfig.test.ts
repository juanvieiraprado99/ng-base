import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseJsonWithComments } from "../src/lib/parse-jsonc";
import {
  applyTsconfigAliases,
  planTsconfigAliases,
} from "../src/lib/patch-tsconfig";

// What `ng new` writes: a leading comment block and a trailing comma-free body.
const NG_NEW_TSCONFIG = `/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
/* To learn more about Angular compiler options: https://angular.dev/reference/configs/angular-compiler-options. */
{
  "compileOnSave": false,
  "compilerOptions": {
    // keep me
    "strict": true,
    "target": "ES2022"
  },
  "angularCompilerOptions": {
    "strictTemplates": true
  }
}
`;

let dir: string;
beforeEach(async () => {
  dir = await fse.mkdtemp(path.join(os.tmpdir(), "ngx-tsconfig-"));
});
afterEach(async () => {
  await fse.remove(dir);
});

describe("tsconfig alias patch", () => {
  it("adds aliases and keeps comments and formatting", async () => {
    await fse.writeFile(path.join(dir, "tsconfig.json"), NG_NEW_TSCONFIG);
    const plan = await planTsconfigAliases(dir, {
      "@core": "src/app/core",
      "@shared": "src/app/shared",
    });
    if (!plan.ok) throw new Error("plan failed");
    expect(plan.missing).toEqual({
      "@core/*": ["./src/app/core/*"],
      "@shared/*": ["./src/app/shared/*"],
    });
    const out = applyTsconfigAliases(plan.raw, plan.missing);
    expect(out).toContain("/* To learn more about Angular compiler options");
    expect(out).toContain("// keep me");
    expect(out).toContain('"strictTemplates": true');
    expect(out).not.toContain("baseUrl");
    const parsed = parseJsonWithComments(out) as {
      compilerOptions: { paths: Record<string, string[]>; strict: boolean };
    };
    expect(parsed.compilerOptions.strict).toBe(true);
    expect(parsed.compilerOptions.paths["@core/*"]).toEqual([
      "./src/app/core/*",
    ]);
  });

  it("only reports missing aliases and honours baseUrl", async () => {
    await fse.writeFile(
      path.join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          baseUrl: "src",
          paths: { "@core/*": ["app/core/*"] },
        },
      }),
    );
    const plan = await planTsconfigAliases(dir, {
      "@core": "src/app/core",
      "@pages": "src/app/pages",
    });
    if (!plan.ok) throw new Error("plan failed");
    expect(plan.missing).toEqual({ "@pages/*": ["app/pages/*"] });
  });

  it("reports missing / unparsable tsconfig", async () => {
    expect(await planTsconfigAliases(dir, {})).toEqual({
      ok: false,
      reason: "missing",
    });
    await fse.writeFile(path.join(dir, "tsconfig.json"), "{ nope");
    expect(await planTsconfigAliases(dir, {})).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});
