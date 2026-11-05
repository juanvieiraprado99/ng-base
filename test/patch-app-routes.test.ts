import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { patchAppRoutes } from "../src/lib/patch-app-routes";

let dir: string;

beforeEach(async () => {
  dir = await fse.mkdtemp(path.join(os.tmpdir(), "ngx-routes-"));
});
afterEach(async () => {
  await fse.remove(dir);
});

async function writeRoutes(content: string): Promise<string> {
  const p = path.join(dir, "src/app/app.routes.ts");
  await fse.outputFile(p, content, "utf8");
  return p;
}

describe("patchAppRoutes", () => {
  it("reports absent when there is no app.routes.ts", async () => {
    expect(await patchAppRoutes(dir)).toEqual({
      exists: false,
      patched: false,
      ok: true,
    });
  });

  it("merges into the default empty ng-new routes", async () => {
    const p = await writeRoutes(
      "import { Routes } from '@angular/router';\n\nexport const routes: Routes = [];\n",
    );
    const res = await patchAppRoutes(dir);
    expect(res.patched).toBe(true);
    const out = await fse.readFile(p, "utf8");
    expect(out).toContain(
      "import { PUBLIC_ROUTES } from './routes/public.routes'",
    );
    expect(out).toContain(
      "import { PRIVATE_ROUTES } from './routes/private.routes'",
    );
    expect(out).toMatch(
      /\.\.\.PUBLIC_ROUTES[\s\S]*\.\.\.PRIVATE_ROUTES[\s\S]*'\*\*'/,
    );
  });

  it("keeps user routes and inserts spreads before an existing wildcard", async () => {
    const p = await writeRoutes(`import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'about', loadComponent: () => import('./about').then((m) => m.About) },
  { path: '**', redirectTo: 'about' },
];
`);
    await patchAppRoutes(dir);
    const out = await fse.readFile(p, "utf8");
    expect(out).toContain("path: 'about'");
    expect(out).toContain("redirectTo: 'about'");
    expect(out.match(/'\*\*'/g)).toHaveLength(1);
    expect(out.indexOf("...PRIVATE_ROUTES")).toBeLessThan(out.indexOf("'**'"));
  });

  it("is idempotent", async () => {
    await writeRoutes(
      "import { Routes } from '@angular/router';\nexport const routes: Routes = [];\n",
    );
    await patchAppRoutes(dir);
    expect((await patchAppRoutes(dir)).patched).toBe(false);
  });
});
