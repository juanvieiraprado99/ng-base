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
3. `src/lib/config.ts` — `NgxBaseCliConfig` type + `readNgxBaseConfig` / `writeNgxBaseConfig`; config lives at `.ngx-base-cli.json` in the target Angular project root
4. `src/lib/generate-plan.ts` — `buildGenerationTargets()` maps a config to an array of `GenerationTarget` objects (each has `outPath`, `template`, `vars`, optional `rawContent`)
5. `src/lib/templates.ts` — `applyTemplate(filename, vars)` reads from `src/templates/` (dev) or `dist/templates/` (prod) and replaces `{{VAR}}` tokens
6. `src/templates/*.tpl` — static template files; **copied to `dist/templates/` by `scripts/copy-templates.mjs`** (not bundled by tsup, must be copied manually)

### Template variable tokens

Templates use `{{IMPORT_CACHE_INTERFACE}}`, `{{AUTH_TOKEN_NAME}}`, `{{AUTH_TOKEN_IMPORT}}` (and, for `add` artifacts, `{{SERVICE_CLASS_NAME}}`, `{{BASE_SERVICE_IMPORT}}`, `{{CLASS_NAME}}`, `{{SELECTOR}}`, `{{FN_NAME}}`, `{{PIPE_NAME}}`, plus `{{TEMPLATE_FIELD}}`/`{{STYLE_FIELD}}` for the component `.ts` — pre-rendered decorator lines that switch templateUrl/inline template and styleUrl/none). These are populated in `generate-plan.ts` / `artifact-plan.ts` from the config and CLI flags.

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
| `src/lib/render-target.ts` | Writes a single `GenerationTarget` to disk (mkdir + write) |
| `src/lib/parse-jsonc.ts` | Strips JSON comments before `JSON.parse` (for `tsconfig.json`) |

### Build note

`npm run build` runs `tsup` then `node ./scripts/copy-templates.mjs`. If you add a new `.tpl` file under `src/templates/`, it will be picked up automatically by the copy script. Forgetting to build before testing with `node dist/index.js` means templates won't reflect your changes.

### Tooling

- **Biome** handles lint + format (`biome.json`; excludes `src/templates/` and `dist/`). Use `npm run check` before committing.
- **Vitest** runs the unit tests in `test/**/*.test.ts`. `vitest.config.ts` adds a `resolveJsToTs` plugin so NodeNext-style `./x.js` import specifiers resolve to `./x.ts` during tests.
- Source uses `moduleResolution: NodeNext` + `verbatimModuleSyntax`, so **imports must carry explicit `.js` extensions** (e.g. `import { runInit } from "./commands/init.js"`).
