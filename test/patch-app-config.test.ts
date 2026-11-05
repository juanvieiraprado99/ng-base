import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type NgBaseConfig } from "../src/lib/config";
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

const withAuth: NgBaseConfig = {
  ...DEFAULT_CONFIG,
  importStyle: "relative",
  modules: ["auth"],
};

describe("patchAppConfigForHttp", () => {
  it("reports absent when there is no app.config.ts", async () => {
    const res = await patchAppConfigForHttp(dir, DEFAULT_CONFIG);
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
      /provideHttpClient\(\s*withInterceptors\(\[authInterceptor, cacheInterceptor\]\)\s*\)/,
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
      "provideHttpClient(withInterceptors([authInterceptor, cacheInterceptor]))",
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
    expect(out).toMatch(
      /withInterceptors\(\[authInterceptor, cacheInterceptor\]\)/,
    );
  });

  it("always wires provideHttpClient + the cache interceptor (minimal config)", async () => {
    const p = await writeAppConfig(
      `import { ApplicationConfig } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [],
};
`,
    );
    const res = await patchAppConfigForHttp(dir, DEFAULT_CONFIG);
    expect(res.patched).toBe(true);
    const out = await read(p);
    expect(out).toContain(
      "provideHttpClient(withInterceptors([cacheInterceptor]))",
    );
    expect(out).toContain(
      "import { cacheInterceptor } from './core/interceptors/cache.interceptor'",
    );
  });

  it("moves a legacy BASE_API_URL import from cache.service to tokens/api.tokens", async () => {
    const p = await writeAppConfig(
      `import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { BASE_API_URL } from './core/services/cache.service';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    { provide: BASE_API_URL, useValue: environment.baseApiUrl },
  ],
};
`,
    );
    await patchAppConfigForHttp(dir, DEFAULT_CONFIG);
    const out = await read(p);
    expect(out).not.toContain("./core/services/cache.service");
    expect(out).toContain(
      "import { BASE_API_URL } from './core/tokens/api.tokens'",
    );
    expect(out.match(/BASE_API_URL,? /g)?.length).toBeGreaterThan(0);
    expect(out.match(/import \{ BASE_API_URL/g)).toHaveLength(1);
  });
});

describe("adding modules to an existing app.config.ts", () => {
  const relative = { ...DEFAULT_CONFIG, importStyle: "relative" as const };

  it("inserts a module's interceptor at its canonical position, keeping custom ones", async () => {
    const p = await writeAppConfig(
      `import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { myInterceptor } from './my';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(withInterceptors([authInterceptor, cacheInterceptor, myInterceptor]))],
};
`,
    );
    await patchAppConfigForHttp(dir, {
      ...relative,
      modules: ["auth", "errors"],
    });
    expect(await read(p)).toMatch(
      /withInterceptors\(\[authInterceptor, errorInterceptor, cacheInterceptor, myInterceptor\]\)/,
    );
  });

  it("puts auth first when it is added after the core", async () => {
    const p = await writeAppConfig(
      `import { ApplicationConfig } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [],
};
`,
    );
    await patchAppConfigForHttp(dir, relative);
    await patchAppConfigForHttp(dir, { ...relative, modules: ["logging"] });
    await patchAppConfigForHttp(dir, {
      ...relative,
      modules: ["logging", "auth"],
    });
    expect(await read(p)).toMatch(
      /withInterceptors\(\[authInterceptor, loggingInterceptor, cacheInterceptor\]\)/,
    );
  });

  it("returns a manual snippet when there is no providers array", async () => {
    const p = await writeAppConfig("export const appConfig = buildConfig();\n");
    const res = await patchAppConfigForHttp(dir, {
      ...relative,
      modules: ["auth"],
    });
    expect(res.patched).toBe(false);
    expect(res.manual).toContain(
      "withInterceptors([authInterceptor, cacheInterceptor])",
    );
    expect(await read(p)).toBe("export const appConfig = buildConfig();\n");
  });
});
