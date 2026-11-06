import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../src/lib/config";
import { patchAppConfigForHttp } from "../src/lib/patch-app-config";
import { patchAppRoutes } from "../src/lib/patch-app-routes";
import { detectIndentation } from "../src/lib/ts-project";

// app.config.ts / app.routes.ts exactly as `ng new` (Angular 20+) writes them.
const NG_NEW_APP_CONFIG = `import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes)
  ]
};
`;
const NG_NEW_APP_ROUTES =
  "import { Routes } from '@angular/router';\n\nexport const routes: Routes = [];\n";

let dir: string;
beforeEach(async () => {
  dir = await fse.mkdtemp(path.join(os.tmpdir(), "ngx-fmt-"));
});
afterEach(async () => {
  await fse.remove(dir);
});

describe("AST patches keep the project's formatting", () => {
  it("app.config.ts: one provider per line, 2-space indent", async () => {
    const file = path.join(dir, "src/app/app.config.ts");
    await fse.outputFile(file, NG_NEW_APP_CONFIG);
    await patchAppConfigForHttp(dir, {
      ...DEFAULT_CONFIG,
      naming: "modern",
      modules: ["auth", "errors", "layout"],
    });
    const out = await fse.readFile(file, "utf8");
    expect(out).toContain(`  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor, cacheInterceptor])),
    { provide: BASE_API_URL, useValue: environment.baseApiUrl }
  ]
};`);
  });

  it("app.routes.ts: merged routes on their own lines", async () => {
    const file = path.join(dir, "src/app/app.routes.ts");
    await fse.outputFile(file, NG_NEW_APP_ROUTES);
    await patchAppRoutes(dir);
    const out = await fse.readFile(file, "utf8");
    expect(out).toContain(`export const routes: Routes = [
  ...PUBLIC_ROUTES,
  ...PRIVATE_ROUTES,
  { path: '**', redirectTo: '' }
];`);
  });

  it("detectIndentation", () => {
    expect(detectIndentation("a\n  b\n    c\n")).toBe("  ");
    expect(detectIndentation("a\n    b\n")).toBe("    ");
    expect(detectIndentation("a\n\tb\n")).toBe("\t");
    expect(detectIndentation("a\n")).toBe("  ");
  });
});
