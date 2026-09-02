# Ejectable Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a project override any of the CLI's 38 templates from
`.ngx-base-cli/templates/`, and tell the user when an override has fallen behind
the built-in it was copied from.

**Architecture:** A new `src/lib/template-registry.ts` owns the two-layer lookup
(project override → built-in) and the eject registry (`.ngx-base-cli/templates.json`,
storing the built-in's hash at eject time). `applyTemplate` and
`renderGenerationTarget` gain a `cwd` parameter so they can find the override
directory. A new `eject` command copies, lists, diffs and reverts overrides. The
five files currently built by string concatenation in `generate-plan.ts` become
real templates so `eject` covers everything the CLI writes.

**Tech Stack:** TypeScript (NodeNext, `verbatimModuleSyntax` — imports need
explicit `.js` extensions), commander, @clack/prompts, fs-extra, diff, Vitest,
Biome.

**Spec:** `docs/superpowers/specs/2026-09-02-ejectable-templates-design.md`

## Global Constraints

- Node ≥ 20, ESM only (`"type": "module"`). Imports of local modules **must**
  carry the `.js` extension (`./template-registry.js`), even from `.ts` files.
- Templates are copied to `dist/templates/` by `scripts/copy-templates.mjs`, which
  copies the whole `src/templates` directory — new `.tpl` files are picked up with
  no script change, but `npm run build` is required before `node dist/index.js`.
- `npm run check` (Biome lint + format) must pass. Run `npm run check:fix` before
  committing; Biome enforces double quotes and trailing commas in `src/` and
  `test/`, and **ignores `src/templates/`**.
- Existing behaviour must not change for a project with no overrides. The full
  suite (`npm run test`, currently 105 tests) must stay green after every task.
- Never rename or move an existing `.tpl` file: the manifest
  (`.ngx-base-cli.manifest.json`) stores template filenames in users' projects.
- The override directory is `.ngx-base-cli/templates/`; the registry is
  `.ngx-base-cli/templates.json`. Both live at the Angular project root, beside
  `.ngx-base-cli.json`.

**Before Task 1:** the repository is on `main`. Create a working branch first:

```bash
git checkout -b feat/ejectable-templates
```

---

### Task 1: Two-layer template resolution

Move built-in template discovery into a new registry module, add the override
layer in front of it, and thread the project root through the two render paths.
After this task an override file already wins — nothing creates one yet.

**Files:**
- Create: `src/lib/template-registry.ts`
- Modify: `src/lib/templates.ts` (replace `getTemplatesDir`, add `cwd` param)
- Modify: `src/lib/render-target.ts` (add `cwd` param)
- Modify: `src/commands/init.ts:277`, `src/commands/list.ts:68`, `src/commands/update.ts:87` (pass `cwd`)
- Modify: `src/commands/add.ts:106` (pass `cwd`)
- Modify: `test/templates.test.ts` (pass `cwd`)
- Test: `test/template-registry.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `builtInTemplatesDir(): string`
  - `overrideTemplatesDir(cwd: string): string`
  - `listBuiltInTemplates(): Promise<string[]>`
  - `listOverrideTemplates(cwd: string): Promise<string[]>`
  - `resolveTemplatePath(name: string, cwd: string): Promise<string>`
  - `applyTemplate(filename: string, vars: Record<string, string>, cwd: string): Promise<string>`
  - `renderGenerationTarget(target: GenerationTarget, cwd: string): Promise<string>`

- [ ] **Step 1: Write the failing test**

Create `test/template-registry.test.ts`:

```typescript
import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  builtInTemplatesDir,
  listBuiltInTemplates,
  listOverrideTemplates,
  overrideTemplatesDir,
  resolveTemplatePath,
} from "../src/lib/template-registry";
import { applyTemplate } from "../src/lib/templates";

let dir: string;

beforeEach(async () => {
  dir = await fse.mkdtemp(path.join(os.tmpdir(), "ngx-registry-"));
});
afterEach(async () => {
  await fse.remove(dir);
});

async function writeOverride(name: string, content: string): Promise<void> {
  await fse.outputFile(path.join(overrideTemplatesDir(dir), name), content);
}

describe("listBuiltInTemplates", () => {
  it("lists every shipped .tpl file, sorted", async () => {
    const names = await listBuiltInTemplates();
    expect(names).toContain("feature.service.ts.tpl");
    expect(names).toContain("base.service.ts.tpl");
    expect(names.every((n) => n.endsWith(".tpl"))).toBe(true);
    expect([...names].sort()).toEqual(names);
  });
});

describe("listOverrideTemplates", () => {
  it("is empty when the project has no override directory", async () => {
    expect(await listOverrideTemplates(dir)).toEqual([]);
  });

  it("lists only .tpl files in the override directory", async () => {
    await writeOverride("feature.service.ts.tpl", "custom");
    await fse.outputFile(path.join(overrideTemplatesDir(dir), "README.md"), "x");
    expect(await listOverrideTemplates(dir)).toEqual([
      "feature.service.ts.tpl",
    ]);
  });
});

describe("resolveTemplatePath", () => {
  it("falls back to the built-in when there is no override", async () => {
    const resolved = await resolveTemplatePath("feature.guard.ts.tpl", dir);
    expect(resolved).toBe(
      path.join(builtInTemplatesDir(), "feature.guard.ts.tpl"),
    );
  });

  it("prefers the project override", async () => {
    await writeOverride("feature.guard.ts.tpl", "custom");
    const resolved = await resolveTemplatePath("feature.guard.ts.tpl", dir);
    expect(resolved).toBe(
      path.join(overrideTemplatesDir(dir), "feature.guard.ts.tpl"),
    );
  });
});

describe("applyTemplate with an override", () => {
  it("renders the override instead of the built-in", async () => {
    await writeOverride(
      "feature.guard.ts.tpl",
      "// house style\nexport const {{FN_NAME}} = () => true;\n",
    );
    const out = await applyTemplate(
      "feature.guard.ts.tpl",
      { FN_NAME: "authGuard" },
      dir,
    );
    expect(out).toBe("// house style\nexport const authGuard = () => true;\n");
  });

  it("still reports unreplaced tokens from an override", async () => {
    await writeOverride("feature.guard.ts.tpl", "{{NOT_PROVIDED}}");
    await expect(
      applyTemplate("feature.guard.ts.tpl", {}, dir),
    ).rejects.toThrow(/NOT_PROVIDED/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/template-registry.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/template-registry"`.

- [ ] **Step 3: Create the registry module**

Create `src/lib/template-registry.ts`:

```typescript
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fse from "fs-extra";

/** Project-relative location of template overrides. */
export const OVERRIDE_TEMPLATES_DIR = ".ngx-base-cli/templates";

/**
 * `dist/templates` when the bundle is `dist/index.js`; `src/templates` in dev
 * under `tsx`.
 */
export function builtInTemplatesDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const colocated = path.join(here, "templates");
  const srcSibling = path.resolve(here, "..", "templates");
  if (existsSync(colocated)) {
    return colocated;
  }
  if (existsSync(srcSibling)) {
    return srcSibling;
  }
  return colocated;
}

/** Where a project keeps its own copies of templates. */
export function overrideTemplatesDir(cwd: string): string {
  return path.join(cwd, ".ngx-base-cli", "templates");
}

async function listTplFiles(dir: string): Promise<string[]> {
  if (!(await fse.pathExists(dir))) return [];
  const entries = await fse.readdir(dir);
  return entries.filter((e) => e.endsWith(".tpl")).sort();
}

/** Every template shipped with the CLI. */
export function listBuiltInTemplates(): Promise<string[]> {
  return listTplFiles(builtInTemplatesDir());
}

/** Every template the project has ejected. */
export function listOverrideTemplates(cwd: string): Promise<string[]> {
  return listTplFiles(overrideTemplatesDir(cwd));
}

/**
 * The file to render for `name`: the project's own copy when it exists,
 * otherwise the one shipped with the CLI.
 */
export async function resolveTemplatePath(
  name: string,
  cwd: string,
): Promise<string> {
  const override = path.join(overrideTemplatesDir(cwd), name);
  if (await fse.pathExists(override)) return override;
  return path.join(builtInTemplatesDir(), name);
}
```

- [ ] **Step 4: Rewrite `src/lib/templates.ts`**

Replace the whole file:

```typescript
import fse from "fs-extra";
import { resolveTemplatePath } from "./template-registry.js";

export async function applyTemplate(
  filename: string,
  vars: Record<string, string>,
  cwd: string,
): Promise<string> {
  const tplPath = await resolveTemplatePath(filename, cwd);
  let content = await fse.readFile(tplPath, "utf8");
  for (const [key, value] of Object.entries(vars)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  const leftover = [...content.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map(
    (m) => m[1],
  );
  if (leftover.length > 0) {
    const unique = [...new Set(leftover)].join(", ");
    throw new Error(
      `Template "${filename}" has unreplaced token(s): ${unique}. ` +
        `Provide them in vars or fix the template.`,
    );
  }
  return content;
}
```

`getTemplatesDir` is deleted; it had no callers outside this file.

- [ ] **Step 5: Thread `cwd` through `renderGenerationTarget`**

Replace `src/lib/render-target.ts`:

```typescript
import type { GenerationTarget } from "./generate-plan.js";
import { applyTemplate } from "./templates.js";

export async function renderGenerationTarget(
  target: GenerationTarget,
  cwd: string,
): Promise<string> {
  if (target.rawContent !== undefined) {
    return target.rawContent;
  }
  return applyTemplate(target.template, target.vars, cwd);
}
```

- [ ] **Step 6: Update the four call sites**

In `src/commands/init.ts` (around line 277):

```typescript
    const content = await renderGenerationTarget(t, cwd);
```

In `src/commands/list.ts` (around line 68):

```typescript
      const expected = await renderGenerationTarget(t, cwd);
```

In `src/commands/update.ts` (around line 87):

```typescript
    const newContent = await renderGenerationTarget(t, cwd);
```

In `src/commands/add.ts` (around line 106):

```typescript
    const content = await applyTemplate(f.template, f.vars, cwd);
```

- [ ] **Step 7: Update `test/templates.test.ts` for the new signature**

Replace the whole file:

```typescript
import { describe, expect, it } from "vitest";
import { applyTemplate } from "../src/lib/templates";

// No override directory exists here, so every lookup falls through to built-in.
const CWD = process.cwd();

describe("applyTemplate", () => {
  it("replaces provided tokens", async () => {
    const out = await applyTemplate(
      "base.service.ts.tpl",
      {
        IMPORT_CACHE_INTERFACE: "@core/interfaces/cache.interface",
        SERVICE_DECORATOR: "@Injectable({ providedIn: 'root' })",
        SERVICE_DECORATOR_IMPORT: "Injectable",
      },
      CWD,
    );
    expect(out).toContain("@core/interfaces/cache.interface");
    expect(out).not.toMatch(/\{\{[A-Z0-9_]+\}\}/);
  });

  it("throws on unreplaced tokens", async () => {
    await expect(
      applyTemplate("base.service.ts.tpl", {}, CWD),
    ).rejects.toThrow(/unreplaced token/i);
  });
});
```

- [ ] **Step 8: Run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: typecheck clean; all tests pass (105 existing + 7 new).

- [ ] **Step 9: Lint and commit**

```bash
npm run check:fix
git add src/lib/template-registry.ts src/lib/templates.ts src/lib/render-target.ts src/commands src/index.ts test/template-registry.test.ts test/templates.test.ts
git commit -m "feat(templates): resolve project overrides before built-in templates"
```

---

### Task 2: Convert the five string-built files into templates

`generate-plan.ts` builds five generated files by string concatenation, so they
are invisible to `eject`. Convert them to real templates, proving byte-identical
output with a characterization test written first.

**Files:**
- Create: `src/templates/environment.ts.tpl`
- Create: `src/templates/barrel.index.ts.tpl`
- Create: `src/templates/app.routes.ts.tpl`
- Create: `src/templates/app.html.tpl`
- Modify: `src/lib/generate-plan.ts` (delete the three builder functions, use templates)
- Test: `test/generate-plan-output.test.ts`

**Interfaces:**
- Consumes: `renderGenerationTarget(target, cwd)` from Task 1.
- Produces: four new template names, usable by every later task's `--list`.
  `GenerationTarget.rawContent` remains on the type but no built-in target sets it.

- [ ] **Step 1: Write the characterization test**

This asserts the exact bytes the current builders produce. Create
`test/generate-plan-output.test.ts`:

```typescript
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
    expect(await renderRelative(legacy, "src/environments/environment.ts")).toBe(
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
```

- [ ] **Step 2: Run to confirm the characterization passes and the last case fails**

Run: `npx vitest run test/generate-plan-output.test.ts`
Expected: the six content tests PASS (they describe current behaviour); the last
test ("no built-in target relies on rawContent") FAILS, listing five targets.

- [ ] **Step 3: Create the four templates**

`src/templates/environment.ts.tpl`:

```
export const environment = {
  production: {{PRODUCTION}},
  baseApiUrl: {{BASE_API_URL}},
} as const;
```

`src/templates/barrel.index.ts.tpl`:

```
export * from './cache.service';
export * from './base.service';
```

`src/templates/app.routes.ts.tpl`:

```
import { Routes } from '@angular/router';
import { PRIVATE_ROUTES } from './routes/private.routes';
import { PUBLIC_ROUTES } from './routes/public.routes';

export const routes: Routes = [
  ...PUBLIC_ROUTES,
  ...PRIVATE_ROUTES,
];
```

`src/templates/app.html.tpl`:

```
<router-outlet />
```

Each file ends with exactly one trailing newline — that is what reproduces the
old builders' output. Do not let an editor strip it.

`{{BASE_API_URL}}` is substituted with `JSON.stringify(config.baseApiUrl)`, so
the quotes come from the value, not the template.

- [ ] **Step 4: Rewire `generate-plan.ts`**

Delete `buildEnvironmentTsContent`, `buildBarrelContent` and
`buildAppRoutesContent` (lines 27-60 of the current file), then replace the
targets that used them.

The environment targets become — `envVars` goes immediately after the existing
`const replacement = ...` / `const isDevStyle = ...` lines, which stay exactly as
they are, comment included:

```typescript
  const envVars = (production: boolean): Record<string, string> => ({
    PRODUCTION: String(production),
    BASE_API_URL: JSON.stringify(config.baseApiUrl),
  });

  const envTargets: GenerationTarget[] = [
    {
      outPath: path.join(environmentsDir, "environment.ts"),
      template: "environment.ts.tpl",
      vars: envVars(isDevStyle),
    },
    {
      outPath: path.join(cwd, replacement.with),
      template: "environment.ts.tpl",
      vars: envVars(!isDevStyle),
    },
  ];
```

The barrel target becomes:

```typescript
  if (config.generateBarrel) {
    targets.push({
      outPath: path.join(servicesDir, "index.ts"),
      template: "barrel.index.ts.tpl",
      vars: {},
    });
  }
```

The `app.routes.ts` and `app.html` targets become:

```typescript
      {
        outPath: path.join(appDir, "app.routes.ts"),
        template: "app.routes.ts.tpl",
        vars: {},
      },
```

```typescript
      {
        outPath: path.join(appDir, "app.html"),
        template: "app.html.tpl",
        vars: {},
      },
```

Leave the `rawContent` field on the `GenerationTarget` interface and the
`rawContent` branch in `renderGenerationTarget` — they stay as the honest
representation for computed content, they just have no built-in user now.

- [ ] **Step 5: Run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all pass, including the seven cases from Step 1. If an environment
test fails on a trailing newline, the template file is missing its final
newline.

- [ ] **Step 6: Verify the build copies the new templates**

Run: `npm run build && ls dist/templates | grep -E "environment|barrel|app\."`
Expected: `app.html.tpl`, `app.routes.ts.tpl`, `barrel.index.ts.tpl`,
`environment.ts.tpl`.

- [ ] **Step 7: Lint and commit**

```bash
npm run check:fix
git add src/templates src/lib/generate-plan.ts test/generate-plan-output.test.ts
git commit -m "refactor(generate-plan): render environments, barrel and routes from templates"
```

---

### Task 3: Eject registry and template statuses

The data layer behind `eject`: which templates are ejected, and which have
fallen behind the built-in they were copied from.

**Files:**
- Modify: `src/lib/template-registry.ts`
- Test: `test/template-registry.test.ts` (append)

**Interfaces:**
- Consumes: `listBuiltInTemplates`, `listOverrideTemplates`, `overrideTemplatesDir`,
  `builtInTemplatesDir` from Task 1; `sha256` from `src/lib/manifest.js`.
- Produces:
  - `EjectRegistry` = `{ version: number; templates: Record<string, EjectEntry> }`
  - `EjectEntry` = `{ builtInHash: string; cliVersion: string }`
  - `ejectRegistryPath(cwd: string): string`
  - `readEjectRegistry(cwd: string): Promise<EjectRegistry>`
  - `writeEjectRegistry(cwd: string, registry: EjectRegistry): Promise<void>`
  - `TemplateStatus` = `{ name: string; ejected: boolean; stale: boolean; orphaned: boolean }`
  - `templateStatuses(cwd: string): Promise<TemplateStatus[]>`
  - `resolveTemplateName(input: string, names: string[]): string`

- [ ] **Step 1: Write the failing test**

Append to `test/template-registry.test.ts` (keep the existing imports and
helpers; add these names to the import from `../src/lib/template-registry`:
`readEjectRegistry`, `resolveTemplateName`, `templateStatuses`,
`writeEjectRegistry`):

```typescript
describe("resolveTemplateName", () => {
  const names = [
    "feature.component.html.tpl",
    "feature.component.spec.ts.tpl",
    "feature.component.ts.tpl",
    "feature.service.spec.ts.tpl",
    "feature.service.ts.tpl",
  ];

  it("accepts the bare name", () => {
    expect(resolveTemplateName("feature.service", names)).toBe(
      "feature.service.ts.tpl",
    );
    expect(resolveTemplateName("feature.service.spec", names)).toBe(
      "feature.service.spec.ts.tpl",
    );
    expect(resolveTemplateName("feature.component.html", names)).toBe(
      "feature.component.html.tpl",
    );
  });

  it("accepts the full filename", () => {
    expect(resolveTemplateName("feature.service.ts.tpl", names)).toBe(
      "feature.service.ts.tpl",
    );
  });

  it("errors with the candidate list when nothing matches", () => {
    expect(() => resolveTemplateName("nope", names)).toThrow(
      /Unknown template "nope"/,
    );
  });
});

describe("eject registry", () => {
  it("reads an empty registry when the file is missing", async () => {
    expect(await readEjectRegistry(dir)).toEqual({ version: 1, templates: {} });
  });

  it("round-trips entries", async () => {
    await writeEjectRegistry(dir, {
      version: 1,
      templates: {
        "feature.guard.ts.tpl": { builtInHash: "abc", cliVersion: "0.2.0" },
      },
    });
    const registry = await readEjectRegistry(dir);
    expect(registry.templates["feature.guard.ts.tpl"].builtInHash).toBe("abc");
  });

  it("treats a corrupt registry as empty", async () => {
    await fse.outputFile(
      path.join(dir, ".ngx-base-cli", "templates.json"),
      "{ not json",
    );
    expect(await readEjectRegistry(dir)).toEqual({ version: 1, templates: {} });
  });
});

describe("templateStatuses", () => {
  it("reports every built-in as not ejected by default", async () => {
    const statuses = await templateStatuses(dir);
    expect(statuses.length).toBeGreaterThan(30);
    expect(statuses.every((s) => !s.ejected)).toBe(true);
    expect(statuses.every((s) => !s.orphaned)).toBe(true);
  });

  it("marks an ejected template, and flags it stale when the built-in moved on", async () => {
    await writeOverride("feature.guard.ts.tpl", "custom");
    await writeEjectRegistry(dir, {
      version: 1,
      templates: {
        "feature.guard.ts.tpl": {
          builtInHash: "stale-hash",
          cliVersion: "0.2.0",
        },
      },
    });

    const status = (await templateStatuses(dir)).find(
      (s) => s.name === "feature.guard.ts.tpl",
    );
    expect(status).toMatchObject({ ejected: true, stale: true });
  });

  it("is not stale when the recorded hash still matches the built-in", async () => {
    const builtIn = await fse.readFile(
      path.join(builtInTemplatesDir(), "feature.guard.ts.tpl"),
      "utf8",
    );
    await writeOverride("feature.guard.ts.tpl", "custom");
    await writeEjectRegistry(dir, {
      version: 1,
      templates: {
        "feature.guard.ts.tpl": {
          builtInHash: sha256(builtIn),
          cliVersion: "0.2.0",
        },
      },
    });

    const status = (await templateStatuses(dir)).find(
      (s) => s.name === "feature.guard.ts.tpl",
    );
    expect(status).toMatchObject({ ejected: true, stale: false });
  });

  it("reports an override with no built-in as orphaned", async () => {
    await writeOverride("removed.by.a.newer.cli.tpl", "x");
    const status = (await templateStatuses(dir)).find(
      (s) => s.name === "removed.by.a.newer.cli.tpl",
    );
    expect(status).toMatchObject({ ejected: true, orphaned: true });
  });
});
```

Add `import { sha256 } from "../src/lib/manifest";` to the file's imports.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/template-registry.test.ts`
Expected: FAIL — `readEjectRegistry is not exported` (and the other new names).

- [ ] **Step 3: Implement the registry in `src/lib/template-registry.ts`**

Add to the imports at the top:

```typescript
import { createRequire } from "node:module";
import { sha256 } from "./manifest.js";
```

Append to the file:

```typescript
export interface EjectEntry {
  /** sha256 of the built-in template at the moment it was ejected. */
  builtInHash: string;
  /** Informational: which CLI version the copy was taken from. */
  cliVersion: string;
}

export interface EjectRegistry {
  version: number;
  templates: Record<string, EjectEntry>;
}

const EJECT_REGISTRY_VERSION = 1;

export function ejectRegistryPath(cwd: string): string {
  return path.join(cwd, ".ngx-base-cli", "templates.json");
}

export async function readEjectRegistry(cwd: string): Promise<EjectRegistry> {
  const p = ejectRegistryPath(cwd);
  if (!(await fse.pathExists(p))) {
    return { version: EJECT_REGISTRY_VERSION, templates: {} };
  }
  try {
    const parsed = JSON.parse(
      await fse.readFile(p, "utf8"),
    ) as Partial<EjectRegistry>;
    return {
      version: parsed.version ?? EJECT_REGISTRY_VERSION,
      templates: parsed.templates ?? {},
    };
  } catch {
    console.warn(
      "[ngx-base-cli] .ngx-base-cli/templates.json is not valid JSON — treating it as empty.",
    );
    return { version: EJECT_REGISTRY_VERSION, templates: {} };
  }
}

export async function writeEjectRegistry(
  cwd: string,
  registry: EjectRegistry,
): Promise<void> {
  const ordered: EjectRegistry = {
    version: EJECT_REGISTRY_VERSION,
    templates: Object.fromEntries(
      Object.entries(registry.templates).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      ),
    ),
  };
  await fse.outputFile(
    ejectRegistryPath(cwd),
    `${JSON.stringify(ordered, null, 2)}\n`,
    "utf8",
  );
}

/**
 * The CLI's own version, for the informational `cliVersion` field. Resolution
 * differs between the bundle and `tsx`, and the value is cosmetic, so a failure
 * must never break an eject.
 */
export function cliVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../../package.json") as { version: string };
    return pkg.version;
  } catch {
    return "unknown";
  }
}

export interface TemplateStatus {
  name: string;
  ejected: boolean;
  /** The built-in changed since this template was ejected. */
  stale: boolean;
  /** An override with no matching built-in — likely renamed by a newer CLI. */
  orphaned: boolean;
}

export async function templateStatuses(
  cwd: string,
): Promise<TemplateStatus[]> {
  const builtIn = await listBuiltInTemplates();
  const overrides = await listOverrideTemplates(cwd);
  const registry = await readEjectRegistry(cwd);
  const builtInSet = new Set(builtIn);

  const names = [...new Set([...builtIn, ...overrides])].sort();
  const statuses: TemplateStatus[] = [];

  for (const name of names) {
    const ejected = overrides.includes(name);
    const orphaned = ejected && !builtInSet.has(name);
    let stale = false;

    const recorded = registry.templates[name];
    if (ejected && !orphaned && recorded) {
      const current = await fse.readFile(
        path.join(builtInTemplatesDir(), name),
        "utf8",
      );
      stale = sha256(current) !== recorded.builtInHash;
    }

    statuses.push({ name, ejected, stale, orphaned });
  }

  return statuses;
}

/**
 * Map user input to a template filename. Accepts the bare name
 * (`feature.service`), the name with `.tpl`, or the full filename.
 *
 * Deliberately not a prefix match: `feature.service` would otherwise be
 * ambiguous between the template and its spec.
 */
export function resolveTemplateName(input: string, names: string[]): string {
  const candidates = [input, `${input}.tpl`, `${input}.ts.tpl`];
  const matches = names.filter((n) => candidates.includes(n));

  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    const near = names.filter((n) => n.startsWith(input.split(".")[0]));
    const hint = near.length > 0 ? ` Did you mean: ${near.join(", ")}?` : "";
    throw new Error(`Unknown template "${input}".${hint}`);
  }
  throw new Error(
    `Ambiguous template "${input}" — matches ${matches.join(", ")}. Use the full filename.`,
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx tsc --noEmit && npx vitest run test/template-registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run check:fix
git add src/lib/template-registry.ts test/template-registry.test.ts
git commit -m "feat(templates): add eject registry and template status tracking"
```

---

### Task 4: `eject <name...>` command

**Files:**
- Create: `src/commands/eject.ts`
- Modify: `src/index.ts` (register the command)
- Test: `test/eject.test.ts`

**Interfaces:**
- Consumes: everything Task 3 produced, plus `builtInTemplatesDir`,
  `overrideTemplatesDir`, `listBuiltInTemplates`, `resolveTemplateName`.
- Produces: `runEject(names: string[], cwd: string, opts: EjectOptions): Promise<void>`
  where `EjectOptions = { force?: boolean; list?: boolean; diff?: string; revert?: boolean; yes?: boolean }`.
  Tasks 5-7 add behaviour behind the `list`, `diff` and `revert` fields.

- [ ] **Step 1: Write the failing test**

Create `test/eject.test.ts`:

```typescript
import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runEject } from "../src/commands/eject";
import {
  builtInTemplatesDir,
  overrideTemplatesDir,
  readEjectRegistry,
} from "../src/lib/template-registry";

let dir: string;

beforeEach(async () => {
  dir = await fse.mkdtemp(path.join(os.tmpdir(), "ngx-eject-"));
});
afterEach(async () => {
  await fse.remove(dir);
  process.exitCode = 0;
});

function overridePath(name: string): string {
  return path.join(overrideTemplatesDir(dir), name);
}

describe("runEject", () => {
  it("copies a template by its bare name and records the built-in hash", async () => {
    await runEject(["feature.guard"], dir, {});

    const copied = await fse.readFile(
      overridePath("feature.guard.ts.tpl"),
      "utf8",
    );
    const builtIn = await fse.readFile(
      path.join(builtInTemplatesDir(), "feature.guard.ts.tpl"),
      "utf8",
    );
    expect(copied).toBe(builtIn);

    const registry = await readEjectRegistry(dir);
    expect(registry.templates["feature.guard.ts.tpl"].builtInHash).toHaveLength(
      64,
    );
  });

  it("ejects several templates at once", async () => {
    await runEject(["feature.guard", "feature.pipe"], dir, {});

    expect(await fse.pathExists(overridePath("feature.guard.ts.tpl"))).toBe(
      true,
    );
    expect(await fse.pathExists(overridePath("feature.pipe.ts.tpl"))).toBe(true);
  });

  it("fails on an unknown template without writing anything", async () => {
    await runEject(["not-a-template"], dir, {});

    expect(process.exitCode).toBe(1);
    expect(await fse.pathExists(overrideTemplatesDir(dir))).toBe(false);
  });

  it("refuses to overwrite an existing override without --force", async () => {
    await fse.outputFile(overridePath("feature.guard.ts.tpl"), "mine");

    await runEject(["feature.guard"], dir, {});

    expect(process.exitCode).toBe(1);
    expect(await fse.readFile(overridePath("feature.guard.ts.tpl"), "utf8")).toBe(
      "mine",
    );
  });

  it("--force overwrites and refreshes the recorded hash", async () => {
    await fse.outputFile(overridePath("feature.guard.ts.tpl"), "mine");

    await runEject(["feature.guard"], dir, { force: true });

    const copied = await fse.readFile(
      overridePath("feature.guard.ts.tpl"),
      "utf8",
    );
    expect(copied).not.toBe("mine");
    expect(process.exitCode).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/eject.test.ts`
Expected: FAIL — cannot resolve `../src/commands/eject`.

- [ ] **Step 3: Implement the command**

Create `src/commands/eject.ts`:

```typescript
import path from "node:path";
import * as p from "@clack/prompts";
import fse from "fs-extra";
import pc from "picocolors";
import { sha256 } from "../lib/manifest.js";
import {
  builtInTemplatesDir,
  cliVersion,
  listBuiltInTemplates,
  overrideTemplatesDir,
  readEjectRegistry,
  resolveTemplateName,
  writeEjectRegistry,
} from "../lib/template-registry.js";

export interface EjectOptions {
  force?: boolean;
}

export async function runEject(
  names: string[],
  cwd: string = process.cwd(),
  opts: EjectOptions = {},
): Promise<void> {
  p.intro(pc.inverse(" ngx-base-cli eject "));

  const builtIn = await listBuiltInTemplates();

  // Resolve every name up front: one bad argument should not leave the project
  // half-ejected.
  const resolved: string[] = [];
  for (const input of names) {
    try {
      resolved.push(resolveTemplateName(input, builtIn));
    } catch (err) {
      p.outro(pc.red(err instanceof Error ? err.message : String(err)));
      process.exitCode = 1;
      return;
    }
  }

  const targetDir = overrideTemplatesDir(cwd);
  const existing = resolved.filter((name) =>
    fse.existsSync(path.join(targetDir, name)),
  );
  if (existing.length > 0 && !opts.force) {
    p.outro(
      pc.red(
        `Already ejected: ${existing.join(", ")}. Re-run with --force to overwrite.`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const registry = await readEjectRegistry(cwd);
  const version = cliVersion();

  for (const name of resolved) {
    const source = path.join(builtInTemplatesDir(), name);
    const content = await fse.readFile(source, "utf8");
    await fse.outputFile(path.join(targetDir, name), content, "utf8");
    registry.templates[name] = {
      builtInHash: sha256(content),
      cliVersion: version,
    };
    p.log.success(
      pc.green(`OK: ${path.join(".ngx-base-cli/templates", name)}`),
    );
  }

  await writeEjectRegistry(cwd, registry);

  p.note(
    [
      "These templates are yours now — edit them freely.",
      "`add` and `update` render from them instead of the built-in ones.",
      "",
      `${pc.cyan("ngx-base-cli eject --list")}   ${pc.dim("# see what is ejected")}`,
      `${pc.cyan("ngx-base-cli update")}         ${pc.dim("# apply them to existing files")}`,
    ].join("\n"),
    "Next",
  );
  p.outro(pc.green("ngx-base-cli eject finished."));
}
```

- [ ] **Step 4: Register the command in `src/index.ts`**

Add the import beside the other command imports:

```typescript
import { runEject } from "./commands/eject.js";
```

Add the command registration immediately before `program.parse();`:

```typescript
program
  .command("eject")
  .description(
    "Copy a built-in template into .ngx-base-cli/templates/ so the project owns it",
  )
  .argument("[names...]", "template names, e.g. feature.service")
  .option("-c, --cwd <dir>", "Angular project directory", process.cwd())
  .option("-f, --force", "Overwrite an override that already exists")
  .action((names: string[], opts: { cwd?: string; force?: boolean }) =>
    run(() =>
      runEject(names, opts.cwd ?? process.cwd(), {
        force: opts.force ?? false,
      }),
    ),
  );
```

- [ ] **Step 5: Add the integration test proving an override wins end to end**

Task 1 proved `applyTemplate` prefers an override. This proves the whole `add`
path does, which is what a user actually experiences. Append to
`test/eject.test.ts`:

```typescript
import { runAdd } from "../src/commands/add";
import { runInit } from "../src/commands/init";

describe("an ejected template drives real generation", () => {
  beforeEach(async () => {
    await fse.outputJson(path.join(dir, "package.json"), {
      name: "demo",
      dependencies: { "@angular/core": "^22.0.1" },
    });
    await runInit(dir, { preset: "minimal" });
  });

  it("add renders from the project's copy", async () => {
    await runEject(["feature.service"], dir, {});
    await fse.outputFile(
      overridePath("feature.service.ts.tpl"),
      "// house style
export class {{SERVICE_CLASS_NAME}} {}
",
    );

    await runAdd("user", "service", dir, { skipTests: true });

    expect(
      await fse.readFile(path.join(dir, "src/app/core/services/user.ts"), "utf8"),
    ).toBe("// house style
export class UserService {}
");
  });

  it("reverting restores the built-in output", async () => {
    await runEject(["feature.service"], dir, {});
    await fse.outputFile(
      overridePath("feature.service.ts.tpl"),
      "// house style
export class {{SERVICE_CLASS_NAME}} {}
",
    );
    await runEject(["feature.service"], dir, { revert: true, yes: true });

    await runAdd("user", "service", dir, { skipTests: true });

    expect(
      await fse.readFile(path.join(dir, "src/app/core/services/user.ts"), "utf8"),
    ).toContain("extends BaseService");
  });
});
```

Move both `import` lines to the top of the file with the others. The second case
depends on `--revert` from Task 7 — mark it `it.skip` now and remove the `.skip`
in Task 7's Step 5.

- [ ] **Step 6: Run tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all pass (one skipped until Task 7).

- [ ] **Step 7: Verify by hand**

```bash
npm run build
TMP=$(mktemp -d)
node dist/index.js eject feature.service --cwd "$TMP" 2>&1 | tail -8
ls "$TMP/.ngx-base-cli/templates"
rm -rf "$TMP"
```

Expected: `feature.service.ts.tpl` listed.

- [ ] **Step 8: Commit**

```bash
npm run check:fix
git add src/commands/eject.ts src/index.ts test/eject.test.ts
git commit -m "feat(eject): add eject command for template overrides"
```

---

### Task 5: `eject --list`

**Files:**
- Modify: `src/commands/eject.ts`
- Modify: `src/index.ts` (add `--list`)
- Test: `test/eject.test.ts` (append)

**Interfaces:**
- Consumes: `templateStatuses(cwd)` from Task 3.
- Produces: `EjectOptions` gains `list?: boolean`; `runEject` returns early when set.

- [ ] **Step 1: Write the failing test**

Append to `test/eject.test.ts`:

```typescript
describe("runEject --list", () => {
  it("does not require any names", async () => {
    await runEject([], dir, { list: true });
    expect(process.exitCode).toBe(0);
  });

  it("reports an ejected template as stale when the recorded hash is wrong", async () => {
    await runEject(["feature.guard"], dir, {});

    const registryPath = path.join(dir, ".ngx-base-cli", "templates.json");
    const registry = await fse.readJson(registryPath);
    registry.templates["feature.guard.ts.tpl"].builtInHash = "0".repeat(64);
    await fse.writeJson(registryPath, registry, { spaces: 2 });

    const statuses = await templateStatuses(dir);
    expect(
      statuses.find((s) => s.name === "feature.guard.ts.tpl"),
    ).toMatchObject({ ejected: true, stale: true });
  });
});
```

Add `templateStatuses` to the import from `../src/lib/template-registry`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/eject.test.ts`
Expected: FAIL — `list` is not a valid `EjectOptions` property (TypeScript) and
`templateStatuses` is not imported.

- [ ] **Step 3: Implement `--list`**

In `src/commands/eject.ts`, extend the options and add the branch at the top of
`runEject`, right after `p.intro(...)`:

```typescript
export interface EjectOptions {
  force?: boolean;
  list?: boolean;
}
```

```typescript
  if (opts.list) {
    await printTemplateList(cwd);
    return;
  }
```

Add `templateStatuses` to the import from `../lib/template-registry.js`, and add
this function at the bottom of the file:

```typescript
async function printTemplateList(cwd: string): Promise<void> {
  const statuses = await templateStatuses(cwd);
  const width = Math.max(...statuses.map((s) => s.name.length));

  const body = statuses
    .map((s) => {
      const name = s.name.padEnd(width);
      if (s.orphaned) {
        return `${pc.red("??")}  ${name}  ${pc.red("orphaned — no built-in with this name")}`;
      }
      if (s.stale) {
        return `${pc.yellow("!!")}  ${name}  ${pc.yellow("ejected — built-in changed since eject")}`;
      }
      if (s.ejected) {
        return `${pc.magenta("~~")}  ${name}  ${pc.magenta("ejected")}`;
      }
      return `${pc.dim("--")}  ${pc.dim(name)}  ${pc.dim("built-in")}`;
    })
    .join("\n");
  p.note(body, "Templates");

  const ejected = statuses.filter((s) => s.ejected).length;
  const stale = statuses.filter((s) => s.stale).length;
  const parts = [`${statuses.length} templates`, `${ejected} ejected`];
  if (stale > 0) {
    parts.push(pc.yellow(`${stale} behind the built-in`));
  }
  p.outro(parts.join(pc.dim(" · ")));
}
```

- [ ] **Step 4: Add the flag in `src/index.ts`**

In the `eject` command registration, add the option and pass it through:

```typescript
  .option("-l, --list", "Show which templates are ejected and which are stale")
```

```typescript
  .action(
    (names: string[], opts: { cwd?: string; force?: boolean; list?: boolean }) =>
      run(() =>
        runEject(names, opts.cwd ?? process.cwd(), {
          force: opts.force ?? false,
          list: opts.list ?? false,
        }),
      ),
  );
```

- [ ] **Step 5: Run tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
npm run check:fix
git add src/commands/eject.ts src/index.ts test/eject.test.ts
git commit -m "feat(eject): add --list showing ejected and stale templates"
```

---

### Task 6: `eject --diff`

Show what separates a project's override from today's built-in. The diff
renderer currently lives inside `update.ts`; move it to a shared module.

**Files:**
- Create: `src/lib/diff.ts`
- Modify: `src/commands/update.ts` (delete the local `formatDiff`, import it)
- Modify: `src/commands/eject.ts`
- Modify: `src/index.ts` (add `--diff`)
- Test: `test/eject.test.ts` (append)

**Interfaces:**
- Consumes: `resolveTemplateName`, `builtInTemplatesDir`, `overrideTemplatesDir`.
- Produces: `formatDiff(oldContent: string, newContent: string): string` from
  `src/lib/diff.js`; `EjectOptions` gains `diff?: string`.

- [ ] **Step 1: Write the failing test**

Append to `test/eject.test.ts`:

```typescript
describe("runEject --diff", () => {
  it("errors when the template is not ejected", async () => {
    await runEject([], dir, { diff: "feature.guard" });
    expect(process.exitCode).toBe(1);
  });

  it("succeeds for an ejected template", async () => {
    await runEject(["feature.guard"], dir, {});
    await fse.outputFile(
      overridePath("feature.guard.ts.tpl"),
      "// our own guard\n",
    );

    await runEject([], dir, { diff: "feature.guard" });
    expect(process.exitCode).toBe(0);
  });
});
```

And create `test/diff.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { formatDiff } from "../src/lib/diff";

describe("formatDiff", () => {
  it("marks added and removed lines", () => {
    const out = formatDiff("a\nb\n", "a\nc\n");
    expect(out).toContain("- b");
    expect(out).toContain("+ c");
    expect(out).toContain("  a");
  });

  it("returns an empty string for identical input", () => {
    expect(formatDiff("same\n", "same\n")).toBe("  same");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/diff.test.ts test/eject.test.ts`
Expected: FAIL — cannot resolve `../src/lib/diff`; `diff` is not a valid
`EjectOptions` property.

- [ ] **Step 3: Extract the diff renderer**

Create `src/lib/diff.ts` with the function moved verbatim from
`src/commands/update.ts`:

```typescript
import { diffLines } from "diff";
import pc from "picocolors";

/** Unified-ish coloured diff, one line per source line. */
export function formatDiff(oldContent: string, newContent: string): string {
  const parts = diffLines(oldContent, newContent);
  let out = "";
  for (const part of parts) {
    const lines = part.value.replace(/\n$/, "").split("\n");
    for (const line of lines) {
      if (part.added) {
        out += `${pc.green(`+ ${line}`)}\n`;
      } else if (part.removed) {
        out += `${pc.red(`- ${line}`)}\n`;
      } else {
        out += `  ${line}\n`;
      }
    }
  }
  return out.trimEnd();
}
```

In `src/commands/update.ts`:

1. Delete the local `formatDiff` function (lines 23-39 of the current file).
2. Delete `import { diffLines } from "diff";` — nothing else in the file uses it.
3. Keep `import pc from "picocolors";` — the rest of the command still colours output.
4. Add, with the other `../lib/` imports:

```typescript
import { formatDiff } from "../lib/diff.js";
```

`diff` stays a runtime dependency of the package; only its import site moves.

- [ ] **Step 4: Implement `--diff` in `src/commands/eject.ts`**

Extend the options:

```typescript
export interface EjectOptions {
  force?: boolean;
  list?: boolean;
  diff?: string;
}
```

Add the branch after the `--list` branch:

```typescript
  if (opts.diff) {
    await printTemplateDiff(cwd, opts.diff);
    return;
  }
```

Add `import { formatDiff } from "../lib/diff.js";` and this function:

```typescript
async function printTemplateDiff(cwd: string, input: string): Promise<void> {
  const builtIn = await listBuiltInTemplates();
  let name: string;
  try {
    name = resolveTemplateName(input, builtIn);
  } catch (err) {
    p.outro(pc.red(err instanceof Error ? err.message : String(err)));
    process.exitCode = 1;
    return;
  }

  const overridePath = path.join(overrideTemplatesDir(cwd), name);
  if (!(await fse.pathExists(overridePath))) {
    p.outro(
      pc.red(
        `"${name}" is not ejected — there is nothing to compare. Run \`ngx-base-cli eject ${input}\` first.`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const override = await fse.readFile(overridePath, "utf8");
  const current = await fse.readFile(
    path.join(builtInTemplatesDir(), name),
    "utf8",
  );

  if (override === current) {
    p.outro(pc.green(`${name} is identical to the built-in template.`));
    return;
  }

  p.log.message(
    `${pc.bold(name)} ${pc.dim("(- your copy, + current built-in)")}`,
  );
  console.log(formatDiff(override, current));
  p.outro(
    pc.dim(
      "Merge anything you want from the built-in into your copy by hand, then re-run `ngx-base-cli update`.",
    ),
  );
}
```

- [ ] **Step 5: Add the flag in `src/index.ts`**

```typescript
  .option("-d, --diff <name>", "Diff an ejected template against the built-in")
```

Extend the action's options type with `diff?: string` and pass
`diff: opts.diff` into `runEject`.

- [ ] **Step 6: Run tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all pass, including the existing update tests that exercise diff
output.

- [ ] **Step 7: Commit**

```bash
npm run check:fix
git add src/lib/diff.ts src/commands/eject.ts src/commands/update.ts src/index.ts test/diff.test.ts test/eject.test.ts
git commit -m "feat(eject): add --diff against the current built-in template"
```

---

### Task 7: `eject --revert`

**Files:**
- Modify: `src/commands/eject.ts`
- Modify: `src/index.ts` (add `--revert` and `--yes`)
- Test: `test/eject.test.ts` (append)

**Interfaces:**
- Consumes: `readEjectRegistry`, `writeEjectRegistry`, `overrideTemplatesDir`.
- Produces: `EjectOptions` gains `revert?: boolean` and `yes?: boolean`.

- [ ] **Step 1: Write the failing test**

Append to `test/eject.test.ts`:

```typescript
describe("runEject --revert", () => {
  it("deletes the override and its registry entry", async () => {
    await runEject(["feature.guard"], dir, {});
    expect(await fse.pathExists(overridePath("feature.guard.ts.tpl"))).toBe(
      true,
    );

    await runEject(["feature.guard"], dir, { revert: true, yes: true });

    expect(await fse.pathExists(overridePath("feature.guard.ts.tpl"))).toBe(
      false,
    );
    const registry = await readEjectRegistry(dir);
    expect(registry.templates["feature.guard.ts.tpl"]).toBeUndefined();
  });

  it("reports when there was nothing to revert", async () => {
    await runEject(["feature.guard"], dir, { revert: true, yes: true });
    expect(process.exitCode).toBe(0);
  });

  it("reverts an orphaned override too", async () => {
    await fse.outputFile(overridePath("removed.by.newer.cli.tpl"), "x");

    await runEject(["removed.by.newer.cli.tpl"], dir, {
      revert: true,
      yes: true,
    });

    expect(
      await fse.pathExists(overridePath("removed.by.newer.cli.tpl")),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/eject.test.ts`
Expected: FAIL — `revert` is not a valid `EjectOptions` property.

- [ ] **Step 3: Implement revert**

Extend the options:

```typescript
export interface EjectOptions {
  force?: boolean;
  list?: boolean;
  diff?: string;
  revert?: boolean;
  /** Skip the confirmation prompt (also implied when stdin is not a TTY). */
  yes?: boolean;
}
```

Add the branch after the `--diff` branch:

```typescript
  if (opts.revert) {
    await revertTemplates(names, cwd, opts.yes ?? false);
    return;
  }
```

Add `listOverrideTemplates` to the import from `../lib/template-registry.js`,
and add this function:

```typescript
async function revertTemplates(
  names: string[],
  cwd: string,
  yes: boolean,
): Promise<void> {
  // Revert must also work for orphaned overrides, so resolve against what is
  // actually on disk rather than against the built-in list.
  const overrides = await listOverrideTemplates(cwd);
  const resolved: string[] = [];
  for (const input of names) {
    try {
      resolved.push(resolveTemplateName(input, overrides));
    } catch {
      p.log.warn(pc.yellow(`Not ejected: ${input} — skipped.`));
    }
  }

  if (resolved.length === 0) {
    p.outro(pc.yellow("Nothing to revert."));
    return;
  }

  p.note(
    resolved
      .map((n) => pc.red(path.join(".ngx-base-cli/templates", n)))
      .join("\n"),
    "Will delete",
  );

  if (!yes && process.stdin.isTTY) {
    const confirmed = await p.confirm({
      message: `Delete ${resolved.length} override(s) and fall back to the built-in templates?`,
      initialValue: false,
    });
    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Cancelled.");
      return;
    }
  }

  const registry = await readEjectRegistry(cwd);
  for (const name of resolved) {
    await fse.remove(path.join(overrideTemplatesDir(cwd), name));
    delete registry.templates[name];
    p.log.success(pc.green(`Reverted: ${name}`));
  }
  await writeEjectRegistry(cwd, registry);

  p.outro(pc.green("ngx-base-cli eject finished."));
}
```

- [ ] **Step 4: Add the flags in `src/index.ts`**

```typescript
  .option("--revert", "Delete an override and fall back to the built-in")
  .option("-y, --yes", "Skip the confirmation prompt (with --revert)")
```

Extend the action's options type with `revert?: boolean; yes?: boolean` and pass
both into `runEject`.

- [ ] **Step 5: Un-skip the revert integration case from Task 4**

In `test/eject.test.ts`, change `it.skip("reverting restores the built-in output"`
back to `it("reverting restores the built-in output"`.

- [ ] **Step 6: Run tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all pass, nothing skipped.

- [ ] **Step 7: Commit**

```bash
npm run check:fix
git add src/commands/eject.ts src/index.ts test/eject.test.ts
git commit -m "feat(eject): add --revert to drop an override"
```

---

### Task 8: `doctor` check and documentation

**Files:**
- Modify: `src/commands/doctor.ts`
- Modify: `README.md` (EN and PT sections)
- Modify: `CLAUDE.md`
- Test: `test/eject.test.ts` (append)

**Interfaces:**
- Consumes: `templateStatuses(cwd)` from Task 3.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Append to `test/eject.test.ts`:

```typescript
describe("doctor template check", () => {
  it("is quiet when nothing is ejected", async () => {
    const checks: Check[] = [];
    await checkTemplates(checks, dir);
    expect(checks).toEqual([]);
  });

  it("reports the ejected count", async () => {
    await runEject(["feature.guard"], dir, {});
    const checks: Check[] = [];
    await checkTemplates(checks, dir);
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ level: "ok" });
    expect(checks[0].detail).toContain("1");
  });

  it("warns about a stale override", async () => {
    await runEject(["feature.guard"], dir, {});
    const registryPath = path.join(dir, ".ngx-base-cli", "templates.json");
    const registry = await fse.readJson(registryPath);
    registry.templates["feature.guard.ts.tpl"].builtInHash = "0".repeat(64);
    await fse.writeJson(registryPath, registry, { spaces: 2 });

    const checks: Check[] = [];
    await checkTemplates(checks, dir);
    expect(checks[0]).toMatchObject({ level: "warn" });
    expect(checks[0].detail).toContain("feature.guard.ts.tpl");
  });
});
```

Add to the imports at the top of the file:

```typescript
import { type Check, checkTemplates } from "../src/commands/doctor";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/eject.test.ts`
Expected: FAIL — `checkTemplates` is not exported from `../src/commands/doctor`.

- [ ] **Step 3: Implement the check**

In `src/commands/doctor.ts`, add the import:

```typescript
import { templateStatuses } from "../lib/template-registry.js";
```

Export the `Check` interface so the test can type its array (change
`interface Check {` to `export interface Check {`), add the new function, and
call it from `runDoctor` after `checkAuthToken`:

```typescript
  await checkAuthToken(checks, cwd, config);
  await checkTemplates(checks, cwd);
```

```typescript
/**
 * Ejected templates are the project's own code, so their presence is fine —
 * what matters is when the built-in they were copied from has moved on.
 */
export async function checkTemplates(
  checks: Check[],
  cwd: string,
): Promise<void> {
  const statuses = await templateStatuses(cwd);
  const ejected = statuses.filter((s) => s.ejected);
  if (ejected.length === 0) return;

  const stale = ejected.filter((s) => s.stale);
  const orphaned = ejected.filter((s) => s.orphaned);

  if (stale.length === 0 && orphaned.length === 0) {
    checks.push({
      level: "ok",
      label: "ejected templates",
      detail: `${ejected.length} template(s) overridden in .ngx-base-cli/templates/, all current.`,
    });
    return;
  }

  const problems: string[] = [];
  if (stale.length > 0) {
    problems.push(
      `built-in changed since eject: ${stale.map((s) => s.name).join(", ")} (see \`ngx-base-cli eject --diff <name>\`)`,
    );
  }
  if (orphaned.length > 0) {
    problems.push(
      `no built-in with this name: ${orphaned.map((s) => s.name).join(", ")}`,
    );
  }

  checks.push({
    level: "warn",
    label: "ejected templates",
    detail: problems.join(" · "),
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all pass.

- [ ] **Step 5: Document the command in `README.md`**

Add this section immediately before `## \`--yes\` / \`--preset\` flags (init)`:

```markdown
## `eject` command — own your templates

The generated code is yours; with `eject`, so are the templates that produce it.

```bash
npx ngx-base-cli eject feature.service        # copy one template into your project
npx ngx-base-cli eject --list                 # what is ejected, what is stale
npx ngx-base-cli eject --diff feature.service # your copy vs the current built-in
npx ngx-base-cli eject --revert feature.service
```

An ejected template lands in `.ngx-base-cli/templates/` — commit it, it is your
code. From then on `add`, `init` and `update` render from your copy instead of
the built-in one, and the manifest keeps working: change a template, run
`ngx-base-cli update`, and the affected files are regenerated from it.

Eject one template at a time rather than all of them. Everything you do not
eject keeps receiving CLI improvements.

`eject` records the built-in's hash at the moment you copied it, in
`.ngx-base-cli/templates.json`. When a later CLI version changes that built-in,
`eject --list` and `doctor` say so, and `eject --diff <name>` shows what
separates your copy from the current one — you decide what to merge back.

Templates are plain text with `{{TOKEN}}` placeholders. Dropping a token you do
not want is fine; introducing one the CLI does not provide is an error naming
the file and the token.
```

Add the equivalent Portuguese section before `## Flags \`--yes\` / \`--preset\` (init)`:

```markdown
## Comando `eject` — os templates passam a ser teus

O código gerado é teu; com o `eject`, os templates que o produzem também.

```bash
npx ngx-base-cli eject feature.service        # copia um template para o projeto
npx ngx-base-cli eject --list                 # o que está ejetado e o que está desatualizado
npx ngx-base-cli eject --diff feature.service # a tua cópia vs o built-in atual
npx ngx-base-cli eject --revert feature.service
```

Um template ejetado fica em `.ngx-base-cli/templates/` — mete-o no repositório, é
código teu. A partir daí o `add`, o `init` e o `update` renderizam a partir da tua
cópia em vez da built-in, e o manifesto continua a funcionar: mudas o template,
corres `ngx-base-cli update`, e os ficheiros afetados são regenerados.

Ejeta um template de cada vez, não todos. Tudo o que não ejetares continua a
receber as melhorias do CLI.

O `eject` guarda o hash do built-in no momento em que copiaste, no
`.ngx-base-cli/templates.json`. Quando uma versão posterior do CLI mudar esse
built-in, o `eject --list` e o `doctor` avisam, e o `eject --diff <nome>` mostra o
que separa a tua cópia da atual — decides tu o que incorporar.

Os templates são texto com placeholders `{{TOKEN}}`. Retirar um token que não
queres é legítimo; introduzir um que o CLI não fornece dá erro a nomear o
ficheiro e o token.
```

The eject registry is a separate file from `.ngx-base-cli.json`, so it does not
belong in the config table. Instead, add one sentence at the end of the
the manifest section ("## .ngx-base-cli.manifest.json") in **each** language:

> EN: `.ngx-base-cli/templates.json` records which templates you have ejected and
> the built-in hash each copy was taken from. Commit it with the templates.

> PT: O `.ngx-base-cli/templates.json` regista que templates ejetaste e o hash do
> built-in de onde cada cópia saiu. Mete-o no repositório junto com os templates.

- [ ] **Step 6: Update `CLAUDE.md`**

In the "Commands" block, add:

```bash
node dist/index.js eject feature.service       # own a template
node dist/index.js eject --list
```

In the Core flow list, change item 5 to:

```markdown
5. `src/lib/template-registry.ts` — two-layer template lookup (project override in `.ngx-base-cli/templates/` → built-in) plus the eject registry (`.ngx-base-cli/templates.json`, the built-in's hash at eject time). `src/lib/templates.ts` — `applyTemplate(filename, vars, cwd)` renders the resolved file and replaces `{{VAR}}` tokens
```

Add to the "Key lib files" table:

```markdown
| `src/lib/template-registry.ts` | Override → built-in resolution, eject registry, `templateStatuses()`, `resolveTemplateName()` |
| `src/lib/diff.ts` | `formatDiff()` — shared by `update` and `eject --diff` |
```

And note in the Build note section that `src/templates/` now also holds
`environment.ts.tpl`, `barrel.index.ts.tpl`, `app.routes.ts.tpl` and
`app.html.tpl`, which used to be built by string concatenation.

- [ ] **Step 7: Full verification**

Run:

```bash
npm run check
npx tsc --noEmit
npm run test
npm run build
```

Expected: Biome clean, typecheck clean, all tests pass, build succeeds.

- [ ] **Step 8: End-to-end check on a scratch project**

```bash
TMP=$(mktemp -d)
mkdir -p "$TMP/src/app"
echo '{ "name": "demo", "dependencies": { "@angular/core": "^22.0.1" } }' > "$TMP/package.json"
node dist/index.js init --cwd "$TMP" --preset minimal < /dev/null > /dev/null
node dist/index.js eject feature.service --cwd "$TMP" < /dev/null | tail -5
printf '// house style\nexport class {{SERVICE_CLASS_NAME}} {}\n' > "$TMP/.ngx-base-cli/templates/feature.service.ts.tpl"
node dist/index.js add user --cwd "$TMP" < /dev/null > /dev/null
cat "$TMP/src/app/core/services/user.ts"
node dist/index.js eject --list --cwd "$TMP" < /dev/null | grep feature.service
node dist/index.js doctor --cwd "$TMP" < /dev/null | grep -i template
rm -rf "$TMP"
```

Expected: `user.ts` contains `// house style` and `export class UserService {}`;
`--list` shows `feature.service.ts.tpl` as ejected; `doctor` reports one ejected
template.

- [ ] **Step 9: Commit**

```bash
npm run check:fix
git add src/commands/doctor.ts README.md CLAUDE.md test/eject.test.ts
git commit -m "feat(eject): add doctor check and document template overrides"
```

---

## Notes for the implementer

**One deliberate refinement to the spec.** The spec says `resolveTemplateName`
matches on prefix. Prefix matching makes the most common call ambiguous —
`feature.service` prefixes both `feature.service.ts.tpl` and
`feature.service.spec.ts.tpl`. Task 3 implements exact matching against
`input`, `input + ".tpl"` and `input + ".ts.tpl"` instead, which resolves
`feature.service` uniquely and still accepts full filenames. The ambiguity error
is kept as a guard.

**Do not fold Task 2 into Task 1.** The template conversion changes bytes the
CLI writes into users' projects; it needs its own commit and its own
characterization test so a regression is bisectable.

**Manifest interaction is intentional, not a bug.** After a user edits an
ejected template, `list` reports the affected files as `drift` and `update`
rewrites them. That is the feature.
