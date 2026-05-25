# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install deps
npm run build        # compile + copy templates → dist/
npm run dev -- init  # run CLI in dev mode (tsx, no build needed)
npm run typecheck    # type-check without emitting
```

Test a command locally after build:
```bash
node dist/index.js init
node dist/index.js add user
node dist/index.js update
node dist/index.js list
```

## Architecture

CLI built with **commander** + **@clack/prompts**. ESM-only (`"type": "module"`), targets Node 18, bundled with **tsup** to `dist/index.js`.

### Core flow

1. `src/index.ts` — registers the four commands (`init`, `add`, `update`, `list`) via commander
2. `src/commands/` — one file per command; each calls into `src/lib/`
3. `src/lib/config.ts` — `NgxBaseCliConfig` type + `readNgxBaseConfig` / `writeNgxBaseConfig`; config lives at `.ngx-base-cli.json` in the target Angular project root
4. `src/lib/generate-plan.ts` — `buildGenerationTargets()` maps a config to an array of `GenerationTarget` objects (each has `outPath`, `template`, `vars`, optional `rawContent`)
5. `src/lib/templates.ts` — `applyTemplate(filename, vars)` reads from `src/templates/` (dev) or `dist/templates/` (prod) and replaces `{{VAR}}` tokens
6. `src/templates/*.tpl` — static template files; **copied to `dist/templates/` by `scripts/copy-templates.mjs`** (not bundled by tsup, must be copied manually)

### Template variable tokens

Templates use `{{IMPORT_CACHE_INTERFACE}}`, `{{AUTH_TOKEN_NAME}}`, `{{AUTH_TOKEN_IMPORT}}`. These are populated in `generate-plan.ts` from the config.

### Key lib files

| File | Purpose |
|------|---------|
| `src/lib/presets.ts` | `minimal` / `standard` / `full` preset definitions for `--yes` flag |
| `src/lib/patch-angular-json.ts` | Idempotent patch of `angular.json` `fileReplacements` for prod env |
| `src/lib/patch-app-config.ts` | Patch `src/app/app.config.ts` with HTTP providers |
| `src/lib/angular-version.ts` | Reads Angular version from target project's `package.json` |
| `src/lib/import-paths.ts` | Resolves alias vs. relative import strings |
| `src/lib/render-target.ts` | Writes a single `GenerationTarget` to disk (mkdir + write) |
| `src/lib/parse-jsonc.ts` | Strips JSON comments before `JSON.parse` (for `tsconfig.json`) |

### Build note

`npm run build` runs `tsup` then `node ./scripts/copy-templates.mjs`. If you add a new `.tpl` file under `src/templates/`, it will be picked up automatically by the copy script. Forgetting to build before testing with `node dist/index.js` means templates won't reflect your changes.
