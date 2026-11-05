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
npm run e2e          # build + scripts/e2e.mjs: ng new → init → add → ng build (network; scenarios: modern, suffixed-relative-ssr)
```

Test a command locally after build:
```bash
node dist/index.js init                      # core only (interactive: API URL, storage, modules)
node dist/index.js init --yes --with auth,errors --dry-run
node dist/index.js add auth layout           # or no names: multiselect
node dist/index.js list
node dist/index.js generate service user --endpoint /users
node dist/index.js doctor
```

## Architecture

CLI built with **commander** + **@clack/prompts**, published as **`ngx-base-cli`**. ESM-only (`"type": "module"`), Node >= 20, bundled with **tsup** to `dist/index.js`.

**Model (shadcn-style):** `init` copies the *core*; `add <module>` copies optional modules. After that the code belongs to the user's project: there is **no sync/update/manifest**, and the CLI never replaces an existing file without `--overwrite` (or a yes to the prompt).

### Core flow

1. `src/index.ts`: registers `init`, `add`, `list` (`ls`), `generate` (`g`, only `service`) and `doctor`.
2. `src/commands/`: one file per command. `init` resolves the workspace, naming and config, then calls `installModules(["core", ...with])`. `add` calls `installModules(ids)`. Both write `.ngx-base-cli.json` and call `printNextSteps`.
3. `src/lib/install.ts`: `installModules(cwd, config, ws, ids, opts)` is the shared engine:
   - tsconfig aliases first; when they can't be added it falls back to relative imports;
   - writes the targets, skipping existing files unless `overwrite`;
   - patches `angular.json` (core), `app.routes.ts` (layout) and `app.config.ts` (any module with an interceptor).
4. `src/lib/modules.ts`: the declarative registry `MODULES`, with entries `{ id, title, description, interceptor?: {name, file, order}, targets(ctx), notes }`.
   - Ids are `core` plus `MODULE_IDS` (`auth | errors | logging | layout`, defined in `config.ts`).
   - `buildModuleTargets(cwd, config, ws, ids)` returns the files to write.
   - `interceptorBindings(config)` gives the canonical interceptor order: auth 10, errors 20, logging 30, cache 100.
   - `pathAliases(config, ws, ids)` maps `@core` always, and `@layout`/`@pages`/`@shared` only with layout.
   - **Independence rule:** a module imports only from the core and from itself (enforced by a test). The one cross-module touch is layout reading `ctx.installed` to add `authGuard`.
   - To add a module: templates in `src/templates/`, an id in `MODULE_IDS` and an entry in `MODULES`.
5. `src/lib/config.ts`: `NgBaseConfig`, `readNgBaseConfig` and `writeNgBaseConfig`, stored as `.ngx-base-cli.json` in the target project root.
   - `CONFIG_FIELDS` (string, boolean or array types) is the single source for validation and for `schema.json` (`buildConfigJsonSchema`, written by `scripts/build-schema.ts`; a test fails if the committed file is stale).
   - A 0.1 config (`generate*` flags) is migrated in place on read by `migrateLegacyConfig`: the `generate*` flags become `modules`.
6. `src/lib/templates.ts`: `applyTemplate(filename, vars)` replaces `{{VAR}}` tokens and non-nested `{{#if VAR}}…{{/if}}` blocks (kept when `vars.VAR === "true"`; for the inverse, use a separate var such as `NO_GUARD`). Any unreplaced `{{TOKEN}}` throws.
7. `src/templates/*.tpl`: static template files, **copied to `dist/templates/` by `scripts/copy-templates.mjs`** (not bundled by tsup).

Targets flagged `createOnly` (`app.html`, `app.routes.ts`) are only written when missing; an existing `app.routes.ts` is merged by `patch-app-routes.ts`.

### Key lib files

| File | Purpose |
|------|---------|
| `src/lib/install.ts` | `installModules`, `printNextSteps` (shared by init/add) |
| `src/lib/modules.ts` | `MODULES` registry, `buildModuleTargets`, `interceptorBindings`, `interceptorOrder`, `pathAliases`, `withModules`, `sortIds` |
| `src/lib/service-plan.ts` | `planService()` for `generate service` |
| `src/lib/naming.ts` | `kebabName` / `pascalName` / `camelName` |
| `src/lib/naming-style.ts` | `NamingStyle` (`modern` \| `suffixed`), `detectNamingStyle()`, `coreFiles(style)`, `structureNames(style)` |
| `src/lib/workspace.ts` | `resolveWorkspace(cwd, project?)`: reads `angular.json` (project, `sourceRoot`, `appDir`, `prefix`, schematics) |
| `src/lib/patch-app-config.ts` | AST patch of `app.config.ts`: `provideHttpClient(withInterceptors([...]))` + `BASE_API_URL`. Missing interceptors are inserted at their canonical position; when `providers` can't be found it returns `manual` (the snippet to paste) |
| `src/lib/patch-app-routes.ts` | Merges PUBLIC/PRIVATE routes + wildcard into `app.routes.ts` |
| `src/lib/patch-angular-json.ts` | Idempotent prod `fileReplacements` |
| `src/lib/patch-tsconfig.ts` | `planTsconfigAliases` / `applyTsconfigAliases` |
| `src/lib/parse-jsonc.ts` | `parseJsonWithComments` + `setJsonValue`: use it for every `tsconfig.json` / `angular.json` write |
| `src/lib/ts-project.ts` | `createPatchSourceFile()`: ts-morph file using the file's own indentation; insert array elements with `{ useNewLines: true }` |
| `src/lib/angular-version.ts` | Angular version from `package.json`; `versionSupportsHttpResource` (19.2+) |
| `src/lib/package-manager.ts` | `detectPackageManager()` + `dlxCommand()` for hints |
| `src/lib/validators.ts` | `validateUrl` / `validateRelativePath` |

### Build note

`npm run build` runs `tsup` then `node ./scripts/copy-templates.mjs`. If you add a new `.tpl` file under `src/templates/`, it will be picked up automatically by the copy script. Forgetting to build before testing with `node dist/index.js` means templates won't reflect your changes.

### Tooling

- **Biome** handles lint + format (`biome.json`; excludes `src/templates/` and `dist/`). Use `npm run check` before committing.
- **Vitest** runs the unit tests in `test/**/*.test.ts`. `test/commands.integration.test.ts` drives `runInit`/`runAdd`/`runGenerate`/`runList`/`runDoctor` on a minimal `ng new`-shaped fixture, with file-list snapshots; update them with `npx vitest run -u` when the generated set changes intentionally. `test/modules.test.ts` renders every module subset and checks the independence rule.
- **CI** (`.github/workflows/ci.yml`): check/typecheck/test/build on ubuntu+windows × node 20/22, then the `scripts/e2e.mjs` scenarios with a real `ng new` + `ng build`. `vitest.config.ts` adds a `resolveJsToTs` plugin so NodeNext-style `./x.js` import specifiers resolve to `./x.ts` during tests.
- Source uses `moduleResolution: NodeNext` + `verbatimModuleSyntax`, so **imports must carry explicit `.js` extensions** (e.g. `import { runInit } from "./commands/init.js"`).
