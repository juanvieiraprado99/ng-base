import path from "node:path";
import { describe, expect, it } from "vitest";
import type { NgxBaseCliConfig } from "../src/lib/config";
import { buildGenerationTargets } from "../src/lib/generate-plan";
import { PRESETS } from "../src/lib/presets";
import { renderGenerationTarget } from "../src/lib/render-target";

const CWD = process.cwd();

const FULL: NgxBaseCliConfig = {
  ...PRESETS.full,
  baseApiUrl: "https://api.example.com",
  environmentStyle: "development",
};

async function renderRelative(
  config: NgxBaseCliConfig,
  relPath: string,
): Promise<string> {
  const targets = buildGenerationTargets(CWD, config);
  const target = targets.find(
    (t) => path.relative(CWD, t.outPath).split(path.sep).join("/") === relPath,
  );
  if (!target) throw new Error(`No target for ${relPath}`);
  return renderGenerationTarget(target, CWD);
}

describe("files that used to be built by string concatenation", () => {
  it("environment.ts is the production build", async () => {
    expect(await renderRelative(FULL, "src/environments/environment.ts")).toBe(
      [
        "export const environment = {",
        "  production: true,",
        '  baseApiUrl: "https://api.example.com",',
        "} as const;",
        "",
      ].join("\n"),
    );
  });

  it("environment.development.ts is the development build", async () => {
    expect(
      await renderRelative(FULL, "src/environments/environment.development.ts"),
    ).toBe(
      [
        "export const environment = {",
        "  production: false,",
        '  baseApiUrl: "https://api.example.com",',
        "} as const;",
        "",
      ].join("\n"),
    );
  });

  it("environment.prod.ts keeps the legacy style output", async () => {
    const legacy: NgxBaseCliConfig = { ...FULL, environmentStyle: "prod" };
    expect(
      await renderRelative(legacy, "src/environments/environment.ts"),
    ).toBe(
      [
        "export const environment = {",
        "  production: false,",
        '  baseApiUrl: "https://api.example.com",',
        "} as const;",
        "",
      ].join("\n"),
    );
    expect(
      await renderRelative(legacy, "src/environments/environment.prod.ts"),
    ).toBe(
      [
        "export const environment = {",
        "  production: true,",
        '  baseApiUrl: "https://api.example.com",',
        "} as const;",
        "",
      ].join("\n"),
    );
  });

  it("the services barrel", async () => {
    expect(await renderRelative(FULL, "src/app/core/services/index.ts")).toBe(
      "export * from './cache.service';\nexport * from './base.service';\n",
    );
  });

  it("app.routes.ts", async () => {
    expect(await renderRelative(FULL, "src/app/app.routes.ts")).toBe(
      [
        "import { Routes } from '@angular/router';",
        "import { PRIVATE_ROUTES } from './routes/private.routes';",
        "import { PUBLIC_ROUTES } from './routes/public.routes';",
        "",
        "export const routes: Routes = [",
        "  ...PUBLIC_ROUTES,",
        "  ...PRIVATE_ROUTES,",
        "];",
        "",
      ].join("\n"),
    );
  });

  it("app.html", async () => {
    expect(await renderRelative(FULL, "src/app/app.html")).toBe(
      "<router-outlet />\n",
    );
  });

  it("no built-in target relies on rawContent any more", async () => {
    const targets = buildGenerationTargets(CWD, FULL);
    expect(targets.filter((t) => t.rawContent !== undefined)).toEqual([]);
  });
});
