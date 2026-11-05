# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install deps
npm run build        # compile + copy templates → dist/
npm run dev -- init  # run CLI in dev mode (tsx, no build needed)
npm run typecheck    # type-check without emitting
npm run test         # vitest run
npm run test:watch   # vitest (watch mode)
npm run lint         # biome lint .
npm run format       # biome format --write .
npm run check        # biome check . (lint + format)
npm run check:fix    # biome check --write .
npm run schema       # regenerate schema.json from CONFIG_FIELDS (also run by build)
npm run e2e          # build + scripts/e2e.mjs: ng new → init → ng build (network; scenarios: modern-full, suffixed-relative-ssr)
```

Test a command locally after build:
```bash
node dist/index.js init
node dist/index.js init --dry-run
node dist/index.js add user
node dist/index.js add user --type component
node dist/index.js add user --type component --inline-template --style none
node dist/index.js add user --type pipe        # also: directive | interface | store | enum
node dist/index.js remove user --type pipe
node dist/index.js update
node dist/index.js update --force
node dist/index.js list
node dist/index.js doctor
```

## Architecture

CLI built with **commander** + **@clack/prompts**. ESM-only (`"type": "module"`), targets Node 18, bundled with **tsup** to `dist/index.js`.

### Core flow

1. `src/index.ts` — registers the six commands (`init`, `add`, `remove`, `update`, `list`, `doctor`) via commander
2. `src/commands/` — one file per command; each calls into `src/lib/`. `add` and `remove` scaffold/delete one of `service | component | guard | resolver | pipe | directive | interface | store | enum` (`-t, --type`, default `service`), driven by `ADD_TYPES` in `src/lib/naming.ts`. Both share `src/lib/artifact-plan.ts` — `planArtifactFiles()` maps a type+name to its output files. `add component` accepts `--inline-template` and `--style scss|css|none`
3. `src/lib/config.ts` — `NgxBaseCliConfig` type + `readNgxBaseConfig` / `writeNgxBaseConfig`; config lives at `.ngx-base-cli.json` in the target Angular project root. `CONFIG_FIELDS` is the single source for validation and for `schema.json` (`buildConfigJsonSchema`, written by `scripts/build-schema.ts`; a test fails if the committed file is stale). New config keys go there
4. `src/lib/generate-plan.ts` — `buildGenerationTargets()` maps a config to an array of `GenerationTarget` objects (each has `outPath`, `template`, `vars`, optional `rawContent`). It is a declarative registry: `FEATURES` lists `{ id, enabled(config), targets(ctx) }` in output order, and `PlanContext` provides the file paths and `target`/`raw`/`dir`/`component`/`importFor` helpers. Add a feature by adding an entry there
5. `src/lib/templates.ts` — `applyTemplate(filename, vars)` reads from `src/templates/` (dev) or `dist/templates/` (prod) and replaces `{{VAR}}` tokens
6. `src/templates/*.tpl` — static template files; **copied to `dist/templates/` by `scripts/copy-templates.mjs`** (not bundled by tsup, must be copied manually)

### Template variable tokens

Init templates get per-file import specifiers computed by `importFor()` in `generate-plan.ts` (alias or relative, honoring `importStyle`): `{{IMPORT_CACHE_INTERFACE}}`, `{{IMPORT_API_TOKENS}}`, `{{IMPORT_AUTH_TOKENS}}`, `{{IMPORT_ROUTES_TOKENS}}`, `{{IMPORT_AUTH_STORE}}`, `{{IMPORT_CACHE_SERVICE}}`, `{{IMPORT_CACHE_INTERCEPTOR}}`, plus `{{STORAGE_FACTORY}}` (cache.storage) and the route/guard imports. `add` artifacts use `{{SERVICE_CLASS_NAME}}`, `{{API_CLIENT_IMPORT}}`, `{{ENDPOINT}}`, `{{CLASS_NAME}}`, `{{SELECTOR}}`, `{{FN_NAME}}`, `{{PIPE_NAME}}`, plus `{{TEMPLATE_FIELD}}`/`{{STYLE_FIELD}}` for the component `.ts`. Templates also support non-nested `{{#if VAR}}…{{/if}}` blocks (kept when `vars.VAR === "true"`, see `renderConditionals` in `templates.ts`) — e.g. `HTTP_RESOURCE` in `api-client.ts.tpl`. Any unreplaced `{{TOKEN}}` throws.

Generated core (all presets): `tokens/api.tokens.ts` (`BASE_API_URL`), `services/api-client.ts` (`ApiClient`, used by composition), `services/cache.service.ts` + `cache.storage.ts` (`CACHE_STORAGE`), `interceptors/cache.interceptor.ts` (always registered, last). `interceptorBindings()` is the single source for interceptor names/order (used by the app.config patch, init notes and doctor). Targets flagged `createOnly` (`app.html`, `app.routes.ts`) are never overwritten or tracked in the manifest; `app.routes.ts` is merged via `src/lib/patch-app-routes.ts`.

### Manifest

`src/lib/manifest.ts` reads/writes `.ngx-base-cli.manifest.json` (version `1`) in the project root — a sha256 hash + source template per generated file. `classifyTarget(disk, rendered, manifestHash)` returns `absent | in-sync | drift | edited`, which `list` and `update` use to tell pristine CLI output apart from local edits. `init`, `add`, and `update` all record their writes there.

### Key lib files

| File | Purpose |
|------|---------|
| `src/lib/presets.ts` | `minimal` / `standard` / `full` preset definitions for `--yes` flag |
| `src/lib/naming.ts` | `kebabName` / `pascalName` / `camelName` / `symbolName` + `ADD_TYPES` for the `add` command |
| `src/lib/artifact-plan.ts` | `planArtifactFiles(type, name, cwd, outputDir, opts)` — shared by `add` and `remove`; `ComponentStyle` + `COMPONENT_STYLES` |
| `src/lib/package-manager.ts` | `detectPackageManager()` (lockfile → npm/pnpm/yarn/bun) + `dlxCommand()` for `init` next-step hints |
| `src/lib/validators.ts` | `validateUrl` / `validateRelativePath` / `validateIdentifier` for prompt input |
| `src/lib/manifest.ts` | Read/write `.ngx-base-cli.manifest.json`; `classifyTarget()` sync states |
| `src/lib/patch-angular-json.ts` | Idempotent patch of `angular.json` `fileReplacements` for prod env |
| `src/lib/patch-app-config.ts` | Patch `src/app/app.config.ts` with HTTP providers (ts-morph AST, not string replacement) |
| `src/lib/angular-version.ts` | Reads Angular version from target project's `package.json` |
| `src/lib/import-paths.ts` | Resolves alias vs. relative import strings |
| `src/lib/workspace.ts` | `resolveWorkspace(cwd, project?)` — reads `angular.json` (project, `sourceRoot`, `appDir`, `prefix`, schematics); falls back to `src/app`. Every command passes the `Workspace` to `buildGenerationTargets` and the patchers |
| `src/lib/naming-style.ts` | `NamingStyle` (`modern` \| `suffixed`), `detectNamingStyle()`, `coreFiles(style)` (init file names) and `structureNames(style)` (layouts/landing). `artifactName()` in `artifact-plan.ts` does the same for `add` |
| `src/lib/render-target.ts` | Writes a single `GenerationTarget` to disk (mkdir + write) |
| `src/lib/parse-jsonc.ts` | `parseJsonWithComments` (jsonc-parser: comments + trailing commas) and `setJsonValue` — edits one JSON path in place, preserving comments/formatting. Use it for any write to `tsconfig.json` / `angular.json` instead of `JSON.stringify` |
| `src/lib/patch-tsconfig.ts` | `planTsconfigAliases` / `applyTsconfigAliases` — the `paths` alias patch used by `init` |
| `src/lib/ts-project.ts` | `createPatchSourceFile()` — ts-morph source file for AST patches (`app.config.ts`, `app.routes.ts`) using the file's own indentation; insert array elements with `{ useNewLines: true }` |

### Build note

`npm run build` runs `tsup` then `node ./scripts/copy-templates.mjs`. If you add a new `.tpl` file under `src/templates/`, it will be picked up automatically by the copy script. Forgetting to build before testing with `node dist/index.js` means templates won't reflect your changes.

### Tooling

- **Biome** handles lint + format (`biome.json`; excludes `src/templates/` and `dist/`). Use `npm run check` before committing.
- **Vitest** runs the unit tests in `test/**/*.test.ts`; `test/commands.integration.test.ts` drives `runInit`/`runUpdate`/`runAdd`/`runList`/`runDoctor` on a minimal `ng new`-shaped fixture (with a file-list snapshot — update it with `npx vitest run -u` when the generated set changes intentionally).
- **CI** (`.github/workflows/ci.yml`): check/typecheck/test/build on ubuntu+windows × node 20/22, then the `scripts/e2e.mjs` scenarios with a real `ng new` + `ng build`. `vitest.config.ts` adds a `resolveJsToTs` plugin so NodeNext-style `./x.js` import specifiers resolve to `./x.ts` during tests.
- Source uses `moduleResolution: NodeNext` + `verbatimModuleSyntax`, so **imports must carry explicit `.js` extensions** (e.g. `import { runInit } from "./commands/init.js"`).
