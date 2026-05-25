import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_NGX_BASE_CONFIG,
  type NgxBaseCliConfig,
} from "../src/lib/config";
import { patchAppConfigForHttp } from "../src/lib/patch-app-config";

let dir: string;

beforeEach(async () => {
  dir = await fse.mkdtemp(path.join(os.tmpdir(), "ngx-appcfg-"));
});
afterEach(async () => {
  await fse.remove(dir);
});

async function writeAppConfig(content: string): Promise<string> {
  const p = path.join(dir, "src/app/app.config.ts");
  await fse.outputFile(p, content, "utf8");
  return p;
}

function read(p: string): Promise<string> {
  return fse.readFile(p, "utf8");
}

const withAuth: NgxBaseCliConfig = {
  ...DEFAULT_NGX_BASE_CONFIG,
  importStyle: "relative",
  generateAuthInterceptor: true,
};

describe("patchAppConfigForHttp", () => {
  it("reports absent when there is no app.config.ts", async () => {
    const res = await patchAppConfigForHttp(dir, DEFAULT_NGX_BASE_CONFIG);
    expect(res).toEqual({ patched: false, appConfigExists: false });
  });

  it("adds withInterceptors to an empty provideHttpClient()", async () => {
    const p = await writeAppConfig(
      `import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient()],
};
`,
    );
    const res = await patchAppConfigForHttp(dir, withAuth);
    expect(res.patched).toBe(true);
    const out = await read(p);
    expect(out).toMatch(
      /provideHttpClient\(\s*withInterceptors\(\[authInterceptor\]\)\s*\)/,
    );
    expect(out).toContain("authInterceptor");
    expect(out).toContain("environment.baseApiUrl");
    expect(out).toContain("BASE_API_URL");
  });

  it("merges into a pre-existing withInterceptors array instead of skipping", async () => {
    const p = await writeAppConfig(
      `import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { existingInterceptor } from './x';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(withInterceptors([existingInterceptor]))],
};
`,
    );
    const res = await patchAppConfigForHttp(dir, withAuth);
    expect(res.patched).toBe(true);
    const out = await read(p);
    expect(out).toContain("existingInterceptor");
    expect(out).toContain("authInterceptor");
  });

  it("does not duplicate when run twice (idempotent)", async () => {
    await writeAppConfig(
      `import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient()],
};
`,
    );
    const first = await patchAppConfigForHttp(dir, withAuth);
    expect(first.patched).toBe(true);
    const second = await patchAppConfigForHttp(dir, withAuth);
    expect(second.patched).toBe(false);
  });

  it("inserts provideHttpClient when absent and interceptors requested", async () => {
    const p = await writeAppConfig(
      `import { ApplicationConfig } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [],
};
`,
    );
    const res = await patchAppConfigForHttp(dir, withAuth);
    expect(res.patched).toBe(true);
    const out = await read(p);
    expect(out).toContain(
      "provideHttpClient(withInterceptors([authInterceptor]))",
    );
  });

  it("survives comments and multiline providers", async () => {
    const p = await writeAppConfig(
      `import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // routing
    provideRouter(routes),
    provideHttpClient(),
  ],
};
`,
    );
    const res = await patchAppConfigForHttp(dir, withAuth);
    expect(res.patched).toBe(true);
    const out = await read(p);
    expect(out).toContain("// routing");
    expect(out).toContain("provideRouter(routes)");
    expect(out).toMatch(/withInterceptors\(\[authInterceptor\]\)/);
  });
});
