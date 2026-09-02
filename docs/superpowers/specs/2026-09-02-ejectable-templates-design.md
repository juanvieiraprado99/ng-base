# Ejectable templates — design

**Date:** 2026-09-02
**Status:** approved, pending implementation plan

## Problem

`ngx-base-cli` is modelled on shadcn/ui: the generated code lives in the user's
repository and is theirs to change. That promise stops at the templates. The 38
`.tpl` files ship inside the npm package, so a team whose house style differs
from the built-in one — a different decorator convention, an internal logger in
the error interceptor, a company header comment — has two options today: edit
every generated file by hand after every `add`, or fork the CLI.

Editing generated files by hand is worse than it sounds, because the manifest
then classifies those files as `edited` and `update` stops maintaining them. The
tool actively punishes customisation.

**Goal:** let a project override any template, keep the `update`/`list`
machinery working on top of the overrides, and make it visible when an override
has fallen behind the built-in it was copied from.

## Decisions

Four decisions were settled during design; they are recorded here because they
constrain everything below.

| Decision | Choice | Why |
|---|---|---|
| Eject granularity | **By name**, one or more at a time | Keeps the overridden surface small, so the rest of the templates keep receiving CLI improvements. A bulk eject makes the easy path the one that costs most to maintain. |
| Staleness | **Record + warn + `--diff`** | A team that ejects at v0.2 must be able to find out that v0.5 fixed a bug in that template. |
| `--diff` base | **User's template vs today's built-in** | Needs only a stored hash, no shadow copy. Shows everything separating you from the current built-in, which is what you act on. |
| Override location | `.ngx-base-cli/templates/` | Sits with the other `.ngx-base-cli.*` project files, and is meant to be committed. |

## Architecture

### Template resolution

`src/lib/templates.ts` today resolves a single directory (`dist/templates` in a
build, `src/templates` under `tsx`). It gains one layer in front:

```
.ngx-base-cli/templates/<name>.tpl   (project override)
        ↓ not found
<package>/templates/<name>.tpl       (built-in)
```

This requires the project root at call time, which `applyTemplate(filename, vars)`
does not currently receive. The signature becomes
`applyTemplate(filename, vars, cwd)`. Only two call sites exist:
`src/lib/render-target.ts` (`renderGenerationTarget`) and `src/commands/add.ts`,
so `cwd` is threaded through `renderGenerationTarget(target, cwd)`.

**Rejected alternative:** a module-level "current template root" set once at
startup. It removes the signature change but introduces hidden global state,
which breaks parallel tests and makes `--cwd` in a monorepo a footgun.

### New module: `src/lib/template-registry.ts`

One place that knows about the two layers, so neither the `eject` command nor
`templates.ts` grows that knowledge:

```ts
export interface TemplateStatus {
  name: string;              // "feature.service.ts.tpl"
  ejected: boolean;
  /** built-in changed since this template was ejected */
  stale: boolean;
  /** an override with no matching built-in — likely renamed by a newer CLI */
  orphaned: boolean;
}

/** Every built-in template name. */
export function listBuiltInTemplates(): Promise<string[]>;
/** Absolute path to use for `name`: override when present, else built-in. */
export function resolveTemplatePath(name: string, cwd: string): Promise<string>;
/** Short name -> full filename; errors on ambiguity or no match. */
export function resolveTemplateName(input: string, names: string[]): string;
export function templateStatuses(cwd: string): Promise<TemplateStatus[]>;
```

`resolveTemplateName` accepts `feature.service` or `feature.service.ts.tpl`,
matching on prefix. Ambiguity is an error listing the candidates rather than a
silent pick — `feature.component` would otherwise be a coin flip between the
component template and its spec.

### Eject registry: `.ngx-base-cli/templates.json`

```json
{
  "version": 1,
  "templates": {
    "feature.service.ts.tpl": {
      "builtInHash": "<sha256 of the built-in at eject time>",
      "cliVersion": "0.2.0"
    }
  }
}
```

`stale` is `sha256(built-in now) !== builtInHash`. `cliVersion` is not used for
logic; it makes the file legible to a human wondering when the copy was taken.

**Why not reuse `.ngx-base-cli.manifest.json`:** that manifest means "files the
CLI wrote into your project, keyed by output path", and its hash is the hash of
the file on disk. Ejected templates are *inputs*, and their recorded hash is the
hash of something else entirely (the built-in). Merging them would make `list`
and `update` treat templates as generated output and try to regenerate them.

### `eject` command

| Invocation | Behaviour |
|---|---|
| `eject <name...>` | Copies each built-in into `.ngx-base-cli/templates/` and records `builtInHash`. Refuses to overwrite an existing override without `--force`. |
| `eject --list` | Every template with its status: `built-in`, `ejected`, or `ejected — built-in changed since eject`. |
| `eject --diff <name>` | Unified diff, override vs current built-in. |
| `eject --revert <name...>` | Deletes the override and its registry entry; the built-in takes over again. Confirms first, `--yes` to skip. |

`formatDiff` currently lives inside `src/commands/update.ts`. It moves to
`src/lib/diff.ts` unchanged and both commands import it.

### Interaction with `update` and `list`

Nothing to build. After ejecting and editing a template, `renderGenerationTarget`
produces different content, so `classifyTarget` reports `drift` for the affected
files and `update` applies them. That is the behaviour we want, and it is the
reason overrides are worth having: customisation stops being a one-way door out
of the update machinery.

`doctor` gains one check: how many templates are ejected, and a warning naming
any that are stale.

### Templates for the five generated files that have none

`environment.ts`, `environment.development.ts`, `services/index.ts`,
`app.routes.ts` and `app.html` are produced by string concatenation in
`src/lib/generate-plan.ts` (`buildEnvironmentTsContent`, `buildBarrelContent`,
`buildAppRoutesContent`, and one inline literal), surfacing as
`GenerationTarget.rawContent`. They would be invisible to `eject`.

They become real templates:

| New template | Tokens |
|---|---|
| `environment.ts.tpl` | `{{PRODUCTION}}`, `{{BASE_API_URL}}` |
| `barrel.index.ts.tpl` | — |
| `app.routes.ts.tpl` | — |
| `app.html.tpl` | — |

`rawContent` stays on the `GenerationTarget` type — it is still the honest
representation for anything computed rather than rendered — but no built-in
target uses it after this change.

**Risk:** silently changing generated bytes. Mitigated by a test that captures
the rendered output of every target before the change and asserts equality
after (see Testing).

## Error handling

- **Unknown token in an override.** `applyTemplate` already throws naming the
  file and the unreplaced tokens. Unchanged — it is exactly the error a user
  editing a template needs.
- **Dropped token in an override.** Legal and silent. A team that does not want
  `{{CHANGE_DETECTION_FIELD}}` simply omits it.
- **Override for a name that is not a built-in template.** `--list` reports it as
  `orphaned` and it is never loaded; likely a rename in a newer CLI. A warning,
  not an error.
- **Corrupt `templates.json`.** Treated as empty, with a warning, matching how
  `readManifest` already behaves.

## Testing

`test/eject.test.ts`:

- eject by short name and by full name; ambiguous short name errors with candidates
- `--force` required to overwrite an existing override
- an override actually wins: `add` and `init` output comes from the project copy
- `--list` reports built-in / ejected / stale correctly (stale simulated by
  rewriting the recorded hash)
- `--diff` output contains the changed lines
- `--revert` restores built-in rendering and clears the registry entry
- orphaned override is reported and not loaded

`test/generate-plan.test.ts` gains a snapshot of every target's rendered output
for a `full` preset config, captured **before** the `rawContent` conversion, to
prove the five converted files are byte-identical afterwards.

Existing `init`/`add` tests gain one case each with an override present.

## Out of scope

- Ejecting all templates at once.
- Sharing template sets between projects (a `templates` npm package, a git URL).
  Worth revisiting once we see whether teams actually want it.
- Migrating an override when the CLI renames a template.
