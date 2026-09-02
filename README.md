# ngx-base-cli

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/ngx-base-cli)](https://nodejs.org/)
[![npm](https://img.shields.io/npm/v/ngx-base-cli)](https://www.npmjs.com/package/ngx-base-cli)

> Portuguese documentation is at the **bottom** of this file — expand **Versão em Português**.

CLI to scaffold `BaseService`, `CacheService`, cache models, and (optionally) HTTP interceptors in Angular projects. The workflow is inspired by [shadcn/ui](https://ui.shadcn.com): the code **lives in your repository** and you can customize it freely.

*Made with love by Juan for the Angular community <3*

## Prerequisites

- **Node.js** ≥ 20
- An **Angular** project (**19 → 22**) with `package.json` at the root (where you run the command)
- If `@angular/core` is not found in `package.json`, the CLI will ask whether you want to continue anyway.

## Angular version support

The CLI reads `@angular/core` from your `package.json` and adapts what it
generates. The detected major is stored as `angularTarget` in
`.ngx-base-cli.json`, so `update` and `list` keep reproducing what `init`
produced even after you upgrade the framework.

| Capability | From | Effect on generated code |
|---|---|---|
| `httpResource` available | **19.1** | `useHttpResource` becomes an option (experimental until v22) |
| v20 style-guide filenames | **20** | `user-guard.ts`, `user-store.ts`, `user.ts` instead of `user.guard.ts`… |
| Zoneless + Vitest defaults | **21** | Generated specs use Vitest; `doctor` flags a Zone.js opt-out |
| `httpResource` stable | **22** | Enabled by default; no experimental warning |
| `OnPush` is the default | **22** | `changeDetection: ChangeDetectionStrategy.OnPush` is omitted |
| `@Service()` decorator | **22** | Replaces `@Injectable({ providedIn: 'root' })` |
| Signal Forms stable | **22** | `add <name> --type form` becomes available |

Upgrading Angular later? Bump `angularTarget` in `.ngx-base-cli.json` and run
`ngx-base-cli update` — `doctor` warns when the two drift apart.

## Quick install

At your Angular project root:

```bash
npx ngx-base-cli@latest init
```

Pre-release versions (`alpha` tag):

```bash
npx ngx-base-cli@beta init
```

The flow is **interactive**. When finished, **`.ngx-base-cli.json`** is created at the root — required for `add` and `update`.

### `init` prompts (summary)

| Prompt | Default / notes |
|--------|-----------------|
| Setup mode | **Quick (preset)** (recommended) or **Custom (step-by-step wizard)** |
| `BASE_API_URL` | `https://api.example.com` (must start with `http://` or `https://`) |
| Output directory | `src/app/core` (**relative** path from the project root) |
| `cache.interface` imports | **Alias** (`@core/interfaces/...`) or **relative** (`../interfaces/...`) |
| `httpResource` on `GET` | Only if Angular ≥ **19.1**; default **yes** from Angular 22, where the Resource API is stable |
| `CacheService` engine | `localStorage` (default), `sessionStorage`, or `memory` (e.g. SSR) |
| HTTP interceptors | Multi-select: `AuthInterceptor` (Bearer), `ErrorInterceptor` (401/403/5xx), `LoggingInterceptor` (dev-only logging), `CacheInterceptor` (serves flagged GETs from `CacheService`) |
| Auth token (if `AuthInterceptor`) | Token name (e.g. `AUTH_TOKEN`) and import path (e.g. `@core/tokens`) |
| Barrel `services/index.ts` | Default **yes** |
| Base folder structure | Default **no**; generates `layout/`, `pages/`, `routes/`, `shared/` under `src/app` and subfolders under `core/` (`directives`, `enum`, `guards`, `interceptors`, `pipes`, `utils`) |
| Existing files | Asks whether to **overwrite** (default **no**) |

### Typical structure after `init`

With `outputDir` = `src/app/core` and optional interceptors:

```text
src/app/core/
├── interfaces/
│   └── cache.interface.ts
├── services/
│   ├── cache.service.ts      # also exports BASE_API_URL
│   ├── base.service.ts
│   └── index.ts              # if barrel was generated
└── interceptors/               # optional
    ├── auth.interceptor.ts
    ├── error.interceptor.ts
    └── logging.interceptor.ts
src/environments/
├── environment.ts
└── environment.development.ts   # environment.prod.ts with environmentStyle: "prod"
```

### Extra structure with **Base folder structure** enabled

```text
src/app/
├── core/
│   ├── directives/
│   ├── enum/
│   ├── guards/
│   ├── interceptors/
│   ├── interfaces/
│   ├── pipes/
│   ├── services/
│   └── utils/
├── layout/
│   ├── private/
│   │   ├── components/
│   │   ├── private.component.html       # <router-outlet />
│   │   └── private.component.ts         # PrivateComponent (logged-in shell)
│   └── public/
│       ├── components/
│       ├── public.component.html        # <router-outlet />
│       └── public.component.ts          # PublicComponent (logged-out shell)
├── pages/
│   └── landing-page/
│       ├── components/
│       ├── interfaces/
│       ├── services/
│       ├── landing-page.component.html
│       └── landing-page.component.ts
├── routes/
│   ├── private.routes.ts                # PRIVATE_ROUTES (loads PrivateComponent)
│   └── public.routes.ts                 # PUBLIC_ROUTES  (loads PublicComponent + landing)
├── shared/
└── app.routes.ts                        # spreads PUBLIC_ROUTES + PRIVATE_ROUTES
```

> `PrivateComponent` and `PublicComponent` act as **shells** for authenticated and public areas. Add your area-specific `header`/`sidebar` here and keep `<router-outlet />` for child routes. The route files use `@layout/*` and `@pages/*` aliases — define them in `tsconfig.json` (see next section).

## After `init`

### 1. Path alias `@core/*` (if you chose alias imports)

In `tsconfig.json` (and `tsconfig.app.json` if applicable):

```json
{
  "compilerOptions": {
    "paths": {
      "@core/*": ["src/app/core/*"],
      "@layout/*": ["src/app/layout/*"],
      "@pages/*": ["src/app/pages/*"],
      "@shared/*": ["src/app/shared/*"]
    }
  }
}
```

Adjust the path if your `outputDir` differs from `src/app/core`. The `@layout/*`, `@pages/*`, and `@shared/*` aliases are used by generated files when **Base folder structure** is enabled.

> Note: when you accept the CLI option to patch `tsconfig.json`, it rewrites the file as JSON and may remove comments.

### 2. Environments and `angular.json` (file replacements)

New projects use the convention the Angular CLI has shipped since v15
(`environmentStyle: "development"`):

- `src/environments/environment.ts` — the **production** values
- `src/environments/environment.development.ts` — replaces it during development

If `angular.json` exists, `init` adds the matching `fileReplacements` entry to
the **`development`** build configuration (idempotent patch). The edit is applied
with `jsonc-parser`, so comments and your existing formatting survive.

Projects initialised by an older version of this CLI keep
`environmentStyle: "prod"` (`environment.prod.ts` patched into the `production`
configuration) until you change the field yourself.

### 3. HTTP providers and `BASE_API_URL`

The **`BASE_API_URL`** token is generated in **`cache.service.ts`** (not in `BaseService`). `init` shows an example with relative imports from `src/app`; alternatively:

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { environment } from '../environments/environment';
import { BASE_API_URL } from '@core/services/cache.service';
import { authInterceptor } from '@core/interceptors/auth.interceptor';
import { errorInterceptor } from '@core/interceptors/error.interceptor';
import { loggingInterceptor } from '@core/interceptors/logging.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor, loggingInterceptor])),
    { provide: BASE_API_URL, useValue: environment.baseApiUrl },
  ],
};
```

If you **did not** generate interceptors, use only `provideHttpClient()` and the `BASE_API_URL` provider.

`init` can also patch `src/app/app.config.ts` automatically (imports + `provideHttpClient(...)` + `{ provide: BASE_API_URL, useValue: environment.baseApiUrl }`). If your `app.config.ts` already contains `withInterceptors(...)`, the CLI will not merge interceptor lists automatically — you must add generated interceptors manually.

### 4. Auth token (if you generated `AuthInterceptor`)

Export an `InjectionToken<string>` at the path you specified (e.g. `@core/tokens`) and provide the value in `providers`:

```typescript
// src/app/core/tokens/auth.token.ts
import { InjectionToken } from '@angular/core';

export const AUTH_TOKEN = new InjectionToken<string>('AUTH_TOKEN');
```

```typescript
// app.config.ts (example)
import { AUTH_TOKEN } from '@core/tokens/auth.token';

providers: [
  // ...
  { provide: AUTH_TOKEN, useValue: 'your-jwt-here' },
];
```

The interceptor adds `Authorization: Bearer <token>` when the token is present.

## Generated files — reference

### `interfaces/cache.interface.ts`

Defines `CacheObject`, `CacheEntry` and `CacheOptions`:

```typescript
export interface CacheEntry<T = unknown> {
  value: T;
}

export interface CacheOptions {
  enabled?: boolean;
  minutesToExpire?: number;
}
```

### `services/cache.service.ts`

- Persistence according to the chosen engine: **localStorage**, **sessionStorage**, or **memory** (`Map`).
- Keys are `ngx-base-cli:<endpoint relative to BASE_API_URL>`; entries expire in minutes.
- `get<T>()` returns `CacheEntry<T> | null` — the wrapper is what lets a cached
  `0`, `""` or `false` count as a hit instead of a miss.
- Every storage access is guarded, so blocked or full storage degrades to "no cache"
  rather than throwing.
- Exports **`BASE_API_URL`** (`InjectionToken<string>`, optional) to compose API-relative URLs in the cache client.

### `services/base.service.ts` (Observable mode, default)

- Integrates **`CacheService`** in the `get()` method.
- `get` signature:

```typescript
get<T>(
  endpoint: string,
  cacheOptions: CacheOptions = {},
  retryNumber: number = 0,
  params?: HttpParams
): Observable<T>
```

- **Cache:** pass `{ enabled: true, minutesToExpire: 10 }` in `cacheOptions`. The cache
  key is the URL **plus the serialized `params`**, so `?page=1` and `?page=2` are
  cached separately.
- **Query string:** use the 4th argument with `HttpParams` (the 2nd is always cache options, not a query object).

```typescript
import { HttpParams } from '@angular/common/http';

const params = new HttpParams().set('page', '1').set('limit', '20');
this.myService.get<Item[]>('/items', {}, 0, params).subscribe(/* ... */);
```

There are also `post`, `put`, `patch`, `delete` with `HttpClient` and `take(1)` where applicable.

**Note:** `CACHE_ENABLED` and `CACHE_MINUTES_TO_EXPIRE` are `HttpContextToken`s
exported from `BaseService`. `get()` reads and writes the cache directly; the
optional `CacheInterceptor` is what consumes those tokens for requests issued
outside `BaseService`.

### `services/base.service.ts` (`httpResource` mode, Angular ≥ 19.1, stable in 22)

- `get` takes an **endpoint factory** and returns `HttpResourceRef<T | undefined>`:

```typescript
get<T>(
  endpointFactory: () => string | undefined,
  options?: HttpResourceOptions<T, unknown>,
): HttpResourceRef<T | undefined>
```

- The factory may read signals — when one changes the request is re-issued and the
  stale response is discarded. Return `undefined` to leave the resource idle.
- The endpoint is resolved against `BASE_API_URL`, exactly like the Observable mode.
- Does **not** inject `CacheService` or use `CacheOptions` in this mode.
- `post`, `put`, `patch`, `delete` remain `Observable`-based as in classic mode.

## `add` command — feature artifacts

Generates a feature artifact under the configured `outputDir`. The artifact type is chosen with `-t, --type` (default **`service`**). Requires `.ngx-base-cli.json`.

File names follow `fileNaming` in `.ngx-base-cli.json`: `classic` (the
`.service.ts` suffixes) or `v20` (the Angular v20 style guide). `init` picks
`v20` on Angular 20+.

| `--type` | `classic` | `v20` (Angular 20+) |
|---|---|---|
| `service` (default) | `services/<kebab>.service.ts` | `services/<kebab>.ts` |
| `component` | `components/<kebab>/<kebab>.component.ts` | `components/<kebab>/<kebab>.ts` |
| `guard` | `guards/<kebab>.guard.ts` | `guards/<kebab>-guard.ts` |
| `resolver` | `resolvers/<kebab>.resolver.ts` | `resolvers/<kebab>-resolver.ts` |
| `pipe` | `pipes/<kebab>.pipe.ts` | `pipes/<kebab>-pipe.ts` |
| `directive` | `directives/<kebab>.directive.ts` | `directives/<kebab>.ts` |
| `interface` | `interfaces/<kebab>.interface.ts` | `interfaces/<kebab>.ts` |
| `store` | `stores/<kebab>.store.ts` | `stores/<kebab>-store.ts` |
| `enum` | `enum/<kebab>.enum.ts` | `enum/<kebab>-enum.ts` |
| `form` *(Angular 22+)* | `forms/<kebab>.form.ts` | `forms/<kebab>-form.ts` |

Every type except `interface` and `enum` also gets a companion `.spec.ts`
(Vitest on Angular 21+, Jasmine when the project's `test` builder is Karma).
Pass `--skip-tests` to opt out for a single artifact, or set
`"generateSpecs": false` in the config.

```bash
npx ngx-base-cli add user                       # service (default)
npx ngx-base-cli add product-catalog
npx ngx-base-cli add user --type component
npx ngx-base-cli add auth --type guard
npx ngx-base-cli add user --type resolver
npx ngx-base-cli add truncate-text --type pipe
npx ngx-base-cli add highlight --type directive
npx ngx-base-cli add user --type interface
npx ngx-base-cli add cart --type store
npx ngx-base-cli add order-status --type enum
npx ngx-base-cli add signup --type form          # Angular 22+
npx ngx-base-cli add user --skip-tests           # no companion .spec.ts
```

#### Component flags

`add --type component` accepts two extra flags:

| Flag | Default | Effect |
|------|---------|--------|
| `--inline-template` | off | Inline `template:` in the decorator; no separate `.html` file |
| `--style <ext>` | `scss` | Stylesheet extension: `scss`, `css`, or `none` (no `styleUrl`) |

```bash
# default: .ts + .html + .scss
npx ngx-base-cli add user --type component

# inline template, no stylesheet — single .ts file
npx ngx-base-cli add user --type component --inline-template --style none

# external template + .css stylesheet
npx ngx-base-cli add user --type component --style css
```

Generated `user.component.ts` (inline template, no style):

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-user',
  template: '<section class="app-user"><!-- UserComponent --></section>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserComponent {}
```

Generated `cart.store.ts` (`add cart --type store`):

```typescript
import { computed, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly _loading = signal(false);

  readonly loading = this._loading.asReadonly();
  readonly ready = computed(() => !this._loading());

  setLoading(value: boolean): void {
    this._loading.set(value);
  }
}
```

> `service` also requires `base.service.ts` in the configured `outputDir` (run `init` first). With the default `outputDir`, `add user` lands at **`src/app/core/services/user.service.ts`**.

Example generated service file (`outputDir = src/app/core`):

```typescript
import { Injectable } from '@angular/core';
import { BaseService } from './base.service';

@Injectable({ providedIn: 'root' })
export class UserService extends BaseService {}
```

### Example usage in a component

```typescript
import { Component, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { UserService } from '@core/services/user.service';

@Component({
  selector: 'app-user-list',
  template: `...`,
})
export class UserListComponent {
  private readonly userService = inject(UserService);

  loadUsers(): void {
    const params = new HttpParams().set('page', '1').set('limit', '20');
    this.userService.get<{ items: unknown[] }>('/users', {}, 0, params).subscribe(/* ... */);
  }

  loadProfile(id: string) {
    return this.userService.get(`/users/${id}`, {
      enabled: true,
      minutesToExpire: 5,
    });
  }

  refreshUsers(): void {
    this.userService.invalidateCache('/users');
  }
}
```

## `remove` command (alias `rm`)

Deletes a generated artifact and drops its entries from the manifest. Same `-t, --type` as `add`. Asks for confirmation before deleting; for `component` it removes the whole feature folder (since `--inline-template` / `--style` change which files exist).

```bash
npx ngx-base-cli remove user --type pipe
npx ngx-base-cli rm user --type component        # removes core/components/user/
npx ngx-base-cli remove order-status --type enum
```

If nothing matches on disk, the command is a no-op and reports it.

## `update` command

Regenerates **`init`** files from **`.ngx-base-cli.json`**, compares with disk, and shows a **colored diff**; asks for confirmation before overwriting each changed file.

Useful after upgrading **ngx-base-cli** or when you want generated code to match the saved config.

```bash
npx ngx-base-cli update
```

Apply all updates without per-file prompts:

```bash
npx ngx-base-cli update --yes
# or
npx ngx-base-cli update -y
```

By default, files you have **locally edited** since the CLI wrote them are detected (via the manifest) and **skipped** to avoid losing your changes. To overwrite them too, pass `-f, --force`:

```bash
npx ngx-base-cli update --force
```

## `list` command

Shows the sync status of every file that `init` would generate, without touching disk. Statuses come from the manifest: **in sync**, **out of date** (pristine CLI output the template would now regenerate differently), **locally edited**, or **absent**. The command exits with a **non-zero code** when any file is out of date or absent, so it can gate CI.

```bash
npx ngx-base-cli list
```

Output example:

```
✅  src/app/core/interfaces/cache.interface.ts     present, in sync
✅  src/app/core/services/cache.service.ts         present, in sync
⚠️   src/app/core/services/base.service.ts          out of date
❌  src/app/core/interceptors/auth.interceptor.ts  absent
```

Useful to audit the project state before running `update`.

`list` always exits **0** so it is safe to pipe. Add `--check` to turn it into a
CI gate — it then exits **1** when any file is absent or out of date:

```bash
npx ngx-base-cli list --check
```

## `doctor` command

Validates your **setup** after `init` (where `list` validates generated **files**). It checks:

- Base files present (`cache.interface.ts`, `cache.service.ts`, `base.service.ts`)
- `src/environments/environment.ts` and its `environmentStyle` counterpart
- The installed Angular version against the `angularTarget` the files were generated for
- A Zone.js opt-out (`provideZoneChangeDetection()`) on Angular 21+, where zoneless is the default
- `tsconfig.json` path aliases (`@core/*`, and `@layout/*` / `@pages/*` / `@shared/*` when project structure is enabled)
- `src/app/app.config.ts` wires `provideHttpClient(...)`, the `BASE_API_URL` provider, and `withInterceptors(...)` when interceptors were generated
- The `AUTH_TOKEN` is provided when `AuthInterceptor` was generated

Exits with a **non-zero code** when any check is an **error**, so it can gate CI.

```bash
npx ngx-base-cli doctor
```

Output example:

```
XX  cache.service.ts present
      Expected at src/app/core/services/cache.service.ts. Run `ngx-base-cli init`.
OK  base.service.ts present
!!  alias @core/*
      Add it to tsconfig.json compilerOptions.paths.
OK  provideHttpClient()
OK  BASE_API_URL provider
```

## `--yes` / `--preset` flags (init)

Skip the full interactive wizard and pick a preset instead:

```bash
npx ngx-base-cli init --yes             # asks which preset, then runs unattended
npx ngx-base-cli init --preset standard # fully unattended (implies --yes)
```

| Preset | Description |
|--------|-------------|
| `minimal` | cache + base service only, localStorage, no interceptors |
| `standard` | cache + base service + auth interceptor + error interceptor + barrel |
| `full` | standard + base folder structure (layout, pages, routes, shared) |

Whichever preset you pick, the version-dependent settings (`angularTarget`,
`fileNaming`, `environmentStyle`, `useHttpResource`) come from the Angular
version detected in `package.json`.

When stdin is not a TTY (CI, pipes), `init` never blocks on a prompt: it uses
`--preset` when given, otherwise `minimal`, accepts the tsconfig alias patch,
and leaves any pre-existing file untouched.

## `--dry-run` flag (init)

Preview what `init` would generate without writing any file to disk:

```bash
npx ngx-base-cli init --dry-run
```

## `--cwd` option

Runs the command as if the project root were another folder (useful in monorepos):

```bash
npx ngx-base-cli init --cwd ./apps/web
npx ngx-base-cli add users --cwd ./apps/web
npx ngx-base-cli update --cwd ./apps/web
```

## `.ngx-base-cli.json`

File at the **Angular project root** (same level as `package.json`). Missing values are filled with CLI defaults when the config is read.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `outputDir` | `string` | `src/app/core` | Base folder for generated files |
| `baseApiUrl` | `string` | `https://api.example.com` | URL used in the `BASE_API_URL` example |
| `importStyle` | `"alias"` \| `"relative"` | `"alias"` | Import style for the cache model |
| `useHttpResource` | `boolean` | `false` | `GET` with `httpResource` (Angular ≥ 19.1; stable in 22) |
| `storageEngine` | `string` | `"localStorage"` | `"localStorage"`, `"sessionStorage"`, or `"memory"` |
| `generateAuthInterceptor` | `boolean` | `false` | Generates `interceptors/auth.interceptor.ts` |
| `authTokenName` | `string` | `"AUTH_TOKEN"` | Imported symbol name in the interceptor |
| `authTokenImportPath` | `string` | `"@core/tokens"` | Import path for the token |
| `generateErrorInterceptor` | `boolean` | `false` | Generates `interceptors/error.interceptor.ts` |
| `generateLoggingInterceptor` | `boolean` | `false` | Generates `interceptors/logging.interceptor.ts` |
| `generateCacheInterceptor` | `boolean` | `false` | Generates `interceptors/cache.interceptor.ts` |
| `generateBarrel` | `boolean` | `true` | Generates `services/index.ts` |
| `generateProjectStructure` | `boolean` | `false` | Generates `layout/`, `pages/landing-page/`, `routes/`, `shared/` under `src/app` and empty subfolders under `core/` (`directives`, `enum`, `guards`, `interceptors`, `pipes`, `utils`); creates/overwrites `app.routes.ts` |

## `.ngx-base-cli.manifest.json`

Alongside the config, `init`, `add`, and `update` maintain **`.ngx-base-cli.manifest.json`** in the project root — a sha256 hash of each generated file. This lets `list` and `update` tell pristine CLI output apart from files you edited by hand (so they can be skipped on update). Safe to commit; do not edit by hand.

## Local development (CLI repository)

```bash
npm install
npm run build
node dist/index.js init
```

During development you can use:

```bash
npm run dev -- init
```

## Upgrading from 0.1.0-beta.2

Existing `.ngx-base-cli.json` files keep working: the new keys default to the
*legacy* behaviour (`fileNaming: "classic"`, `environmentStyle: "prod"`,
`generateSpecs: false`, `angularTarget: 0`), so `update` will not reshuffle a
project you already set up. Opt in by editing those fields, or re-run `init`.

Two things change in the **generated** code the next time you run `update`:

- **`CacheService` storage format.** Keys and values are no longer base64-encoded
  (`btoa` throws on non-Latin1 URLs and added nothing but size). Entries written
  by the previous version are unreadable and are dropped on first access; the old
  keys stay behind harmlessly until the storage is cleared.
- **`CacheService.get` signature.** It now returns `CacheEntry<T> | null` instead
  of the bare value, so a cached `0`/`""`/`false` is a hit rather than a miss.
  If you call `cacheService.get()` directly, read `.value` from the result.
- **`AUTH_TOKEN` shape.** The generated `authInterceptor` now expects
  `InjectionToken<() => string | null>` (a getter, so token refresh works) and
  only attaches the header to URLs belonging to `BASE_API_URL`.

## License

MIT

<details>
<summary><strong>Versão em Português</strong></summary>

CLI para gerar `BaseService`, `CacheService`, modelos de cache e (opcionalmente) interceptors HTTP em projetos Angular. O fluxo inspira-se no [shadcn/ui](https://ui.shadcn.com): o código **fica no teu repositório** e podes ajustar à vontade.

*Criado pelo Juan para a comunidade Angular <3*

## Pré-requisitos

- **Node.js** ≥ 20
- Projeto **Angular** (**19 → 22**) com `package.json` na raiz (onde corres o comando)
- Se `@angular/core` não for encontrado no `package.json`, o CLI pergunta se queres continuar na mesma.

## Suporte de versões do Angular

O CLI lê o `@angular/core` do teu `package.json` e adapta o que gera. A major
detetada fica guardada em `angularTarget` no `.ngx-base-cli.json`, para que
`update` e `list` continuem a reproduzir o que o `init` gerou mesmo depois de
atualizares a framework.

| Capacidade | A partir de | Efeito no código gerado |
|---|---|---|
| `httpResource` disponível | **19.1** | `useHttpResource` passa a ser opção (experimental até à v22) |
| Nomes do style guide v20 | **20** | `user-guard.ts`, `user-store.ts`, `user.ts` em vez de `user.guard.ts`… |
| Zoneless + Vitest por defeito | **21** | Specs gerados em Vitest; `doctor` assinala opt-out do Zone.js |
| `httpResource` estável | **22** | Ativo por predefinição; sem aviso de experimental |
| `OnPush` é o defeito | **22** | `changeDetection: ChangeDetectionStrategy.OnPush` é omitido |
| Decorador `@Service()` | **22** | Substitui `@Injectable({ providedIn: 'root' })` |
| Signal Forms estáveis | **22** | `add <nome> --type form` fica disponível |

Vais atualizar o Angular? Muda o `angularTarget` no `.ngx-base-cli.json` e corre
`ngx-base-cli update` — o `doctor` avisa quando os dois divergem.

## Instalação rápida

Na raiz do projeto Angular:

```bash
npx ngx-base-cli@latest init
```

Versões pré-release (tag `alpha`):

```bash
npx ngx-base-cli@alpha init
```

O fluxo é **interativo**. No final é criado **`.ngx-base-cli.json`** na raiz — necessário para `add` e `update`.

### Perguntas do `init` (resumo)

| Pergunta | Predefinição / notas |
|----------|----------------------|
| Modo de setup | **Rápido (preset)** (recomendado) ou **Custom (wizard passo-a-passo)** |
| `BASE_API_URL` | `https://api.example.com` (deve começar por `http://` ou `https://`) |
| Diretório de saída | `src/app/core` (caminho **relativo** à raiz do projeto) |
| Imports de `cache.interface` | **Alias** (`@core/interfaces/...`) ou **relativo** (`../interfaces/...`) |
| `httpResource` no `GET` | Só se Angular ≥ **19.1**; predefinição **sim** a partir do Angular 22, onde a Resource API é estável |
| Motor do `CacheService` | `localStorage` (predefinido), `sessionStorage` ou `memory` (ex.: SSR) |
| Interceptors HTTP | Multi-select: `AuthInterceptor` (Bearer), `ErrorInterceptor` (401/403/5xx), `LoggingInterceptor` (logs só em dev) |
| Token (se `AuthInterceptor`) | Nome do token (ex. `AUTH_TOKEN`) e caminho de import (ex. `@core/tokens`) |
| Barrel `services/index.ts` | Predefinição **sim** |
| Estrutura base de pastas | Predefinição **não**; gera `layout/`, `pages/`, `routes/`, `shared/` em `src/app` e subpastas em `core/` (`directives`, `enum`, `guards`, `interceptors`, `pipes`, `utils`) |
| Ficheiros já existentes | Pergunta se queres **sobrescrever** (predefinição **não**) |

### Estrutura típica após `init`

Com `outputDir` = `src/app/core` e interceptors opcionais:

```text
src/app/core/
├── interfaces/
│   └── cache.interface.ts
├── services/
│   ├── cache.service.ts      # exporta também BASE_API_URL
│   ├── base.service.ts
│   └── index.ts              # se geraste barrel
└── interceptors/               # opcional
    ├── auth.interceptor.ts
    ├── error.interceptor.ts
    └── logging.interceptor.ts
src/environments/
├── environment.ts
└── environment.development.ts   # environment.prod.ts com environmentStyle: "prod"
```

### Estrutura adicional com `Estrutura base de pastas` ativada

```text
src/app/
├── core/
│   ├── directives/
│   ├── enum/
│   ├── guards/
│   ├── interceptors/
│   ├── interfaces/
│   ├── pipes/
│   ├── services/
│   └── utils/
├── layout/
│   ├── private/
│   │   ├── components/
│   │   ├── private.component.html       # <router-outlet />
│   │   └── private.component.ts         # PrivateComponent (shell área logada)
│   └── public/
│       ├── components/
│       ├── public.component.html        # <router-outlet />
│       └── public.component.ts          # PublicComponent (shell área deslogada)
├── pages/
│   └── landing-page/
│       ├── components/
│       ├── interfaces/
│       ├── services/
│       ├── landing-page.component.html
│       └── landing-page.component.ts
├── routes/
│   ├── private.routes.ts                # PRIVATE_ROUTES (carrega PrivateComponent)
│   └── public.routes.ts                 # PUBLIC_ROUTES  (carrega PublicComponent + landing)
├── shared/
└── app.routes.ts                        # spread de PUBLIC_ROUTES + PRIVATE_ROUTES
```

> Os componentes `PrivateComponent` e `PublicComponent` servem de **shell** para áreas logada e deslogada. Adiciona aqui o teu `header`/`sidebar` específico de cada área e mantém o `<router-outlet />` para os filhos. Os ficheiros de rotas usam aliases `@layout/*` e `@pages/*` — define-os no `tsconfig.json` (ver secção seguinte).

## Depois do `init`

### 1. Path alias `@core/*` (se escolheste imports com alias)

Em `tsconfig.json` (e `tsconfig.app.json` se aplicável):

```json
{
  "compilerOptions": {
    "paths": {
      "@core/*": ["src/app/core/*"],
      "@layout/*": ["src/app/layout/*"],
      "@pages/*": ["src/app/pages/*"],
      "@shared/*": ["src/app/shared/*"]
    }
  }
}
```

Ajusta o caminho se o teu `outputDir` for diferente de `src/app/core`. Os aliases `@layout/*`, `@pages/*` e `@shared/*` são usados pelos ficheiros gerados quando ativas a opção **Estrutura base de pastas**.

> Nota: se aceitares a opção do CLI para patchar `tsconfig.json`, ele reescreve o ficheiro como JSON e pode remover comentários.

### 2. Environments e `angular.json` (file replacements)

Projetos novos usam a convenção que o Angular CLI adota desde a v15
(`environmentStyle: "development"`):

- `src/environments/environment.ts` — os valores de **produção**
- `src/environments/environment.development.ts` — substitui-o em desenvolvimento

Se existir `angular.json`, o `init` acrescenta a entrada `fileReplacements`
correspondente à configuração de build **`development`** (patch idempotente). A
edição é feita com `jsonc-parser`, por isso os comentários e a formatação
existentes sobrevivem.

Projetos inicializados por uma versão anterior deste CLI mantêm
`environmentStyle: "prod"` (`environment.prod.ts` na configuração `production`)
até mudares o campo.

### 3. Providers HTTP e `BASE_API_URL`

O token **`BASE_API_URL`** é gerado em **`cache.service.ts`** (não no `BaseService`). O próprio `init` mostra um exemplo com imports relativos a partir de `src/app`; em alternativa:

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { environment } from '../environments/environment';
import { BASE_API_URL } from '@core/services/cache.service';
import { authInterceptor } from '@core/interceptors/auth.interceptor';
import { errorInterceptor } from '@core/interceptors/error.interceptor';
import { loggingInterceptor } from '@core/interceptors/logging.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor, loggingInterceptor])),
    { provide: BASE_API_URL, useValue: environment.baseApiUrl },
  ],
};
```

Se **não** geraste interceptors, usa apenas `provideHttpClient()` e o provider de `BASE_API_URL`.

O `init` também pode patchar automaticamente `src/app/app.config.ts` (imports + `provideHttpClient(...)` + `{ provide: BASE_API_URL, useValue: environment.baseApiUrl }`). Se o teu `app.config.ts` já tiver `withInterceptors(...)`, o CLI não faz merge automático das listas — tens de adicionar os interceptors gerados manualmente.

### 4. Token de autenticação (se geraste `AuthInterceptor`)

Exporta um `InjectionToken<string>` no caminho que indicaste (ex. `@core/tokens`) e fornece o valor nos `providers`:

```typescript
// src/app/core/tokens/auth.token.ts
import { InjectionToken } from '@angular/core';

export const AUTH_TOKEN = new InjectionToken<string>('AUTH_TOKEN');
```

```typescript
// app.config.ts (exemplo)
import { AUTH_TOKEN } from '@core/tokens/auth.token';

providers: [
  // ...
  { provide: AUTH_TOKEN, useValue: 'teu-jwt-aqui' },
];
```

O interceptor adiciona `Authorization: Bearer <token>` quando o token existe.

## Ficheiros gerados — referência

### `interfaces/cache.interface.ts`

Define `CacheObject` e `CacheOptions`:

```typescript
export interface CacheOptions {
  enabled?: boolean;
  minutesToExpire?: number;
}
```

### `services/cache.service.ts`

- Persistência conforme o motor escolhido: **localStorage**, **sessionStorage** ou **memory** (`Map`).
- Chaves internas com prefixo e codificação do endpoint; suporta expiração em minutos.
- Exporta **`BASE_API_URL`** (`InjectionToken<string>`, opcional) para compor URLs relativas à API no cliente de cache.

### `services/base.service.ts` (modo Observable, predefinido)

- Integra **`CacheService`** no método `get()`.
- Assinatura do `get`:

```typescript
get<T>(
  endpoint: string,
  cacheOptions: CacheOptions = {},
  retryNumber: number = 0,
  params?: HttpParams
): Observable<T>
```

- **Cache:** passa `{ enabled: true, minutesToExpire: 10 }` em `cacheOptions` (o valor por defeito de minutos também é aplicado via `HttpContext` nos pedidos).
- **Query string:** usa o 4.º argumento com `HttpParams` (o 2.º é sempre opções de cache, não um objeto de query).

```typescript
import { HttpParams } from '@angular/common/http';

const params = new HttpParams().set('page', '1').set('limit', '20');
this.myService.get<Item[]>('/items', {}, 0, params).subscribe(/* ... */);
```

Há também `post`, `put`, `patch`, `delete` com `HttpClient` e `take(1)` onde aplicável.

**Nota:** `CACHE_ENABLED` e `CACHE_MINUTES_TO_EXPIRE` são `HttpContextToken` exportados no `BaseService`; o cache em si é aplicado no `tap` do `get`, não por um interceptor que leia esses tokens automaticamente.

### `services/base.service.ts` (modo `httpResource`, Angular ≥ 19.1)

- O método `get` usa `httpResource` e devolve **`HttpResourceRef<T>`**.
- **Não** injeta `CacheService` nem usa `CacheOptions` neste modo.
- `post`, `put`, `patch`, `delete` mantêm-se com `Observable` como no modo clássico.

## Comando `add` — artefactos de feature

Gera um artefacto de feature dentro do `outputDir` configurado. O tipo é escolhido com `-t, --type` (predefinição **`service`**). Exige `.ngx-base-cli.json`.

Os nomes dos ficheiros seguem o `fileNaming` do `.ngx-base-cli.json`:
`classic` (sufixos `.service.ts`) ou `v20` (style guide do Angular v20). O
`init` escolhe `v20` em Angular 20+.

| `--type` | `classic` | `v20` (Angular 20+) |
|---|---|---|
| `service` (predefinido) | `services/<kebab>.service.ts` | `services/<kebab>.ts` |
| `component` | `components/<kebab>/<kebab>.component.ts` | `components/<kebab>/<kebab>.ts` |
| `guard` | `guards/<kebab>.guard.ts` | `guards/<kebab>-guard.ts` |
| `resolver` | `resolvers/<kebab>.resolver.ts` | `resolvers/<kebab>-resolver.ts` |
| `pipe` | `pipes/<kebab>.pipe.ts` | `pipes/<kebab>-pipe.ts` |
| `directive` | `directives/<kebab>.directive.ts` | `directives/<kebab>.ts` |
| `interface` | `interfaces/<kebab>.interface.ts` | `interfaces/<kebab>.ts` |
| `store` | `stores/<kebab>.store.ts` | `stores/<kebab>-store.ts` |
| `enum` | `enum/<kebab>.enum.ts` | `enum/<kebab>-enum.ts` |
| `form` *(Angular 22+)* | `forms/<kebab>.form.ts` | `forms/<kebab>-form.ts` |

Todos os tipos exceto `interface` e `enum` recebem também um `.spec.ts`
(Vitest em Angular 21+, Jasmine quando o builder `test` do projeto é Karma).
Usa `--skip-tests` para saltar num artefacto, ou `"generateSpecs": false` na
configuração.

```bash
npx ngx-base-cli add user                       # service (predefinido)
npx ngx-base-cli add product-catalog
npx ngx-base-cli add user --type component
npx ngx-base-cli add auth --type guard
npx ngx-base-cli add user --type resolver
npx ngx-base-cli add truncate-text --type pipe
npx ngx-base-cli add highlight --type directive
npx ngx-base-cli add user --type interface
npx ngx-base-cli add cart --type store
npx ngx-base-cli add order-status --type enum
```

#### Flags do component

`add --type component` aceita duas flags extra:

| Flag | Predefinição | Efeito |
|------|--------------|--------|
| `--inline-template` | desligada | `template:` inline no decorator; sem ficheiro `.html` |
| `--style <ext>` | `scss` | Extensão da folha de estilos: `scss`, `css` ou `none` (sem `styleUrl`) |

```bash
# predefinição: .ts + .html + .scss
npx ngx-base-cli add user --type component

# template inline, sem estilos — um único .ts
npx ngx-base-cli add user --type component --inline-template --style none

# template externo + folha .css
npx ngx-base-cli add user --type component --style css
```

> `service` exige também `base.service.ts` no `outputDir` configurado (corre `init` primeiro). Com o `outputDir` predefinido, `add user` fica em **`src/app/core/services/user.service.ts`**.

Exemplo de ficheiro de serviço gerado (`outputDir = src/app/core`):

```typescript
import { Injectable } from '@angular/core';
import { BaseService } from './base.service';

@Injectable({ providedIn: 'root' })
export class UserService extends BaseService {}
```

### Exemplo de uso num componente

```typescript
import { Component, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { UserService } from '@core/services/user.service';

@Component({
  selector: 'app-user-list',
  template: `...`,
})
export class UserListComponent {
  private readonly userService = inject(UserService);

  loadUsers(): void {
    const params = new HttpParams().set('page', '1').set('limit', '20');
    this.userService.get<{ items: unknown[] }>('/users', {}, 0, params).subscribe(/* ... */);
  }

  loadProfile(id: string) {
    return this.userService.get(`/users/${id}`, {
      enabled: true,
      minutesToExpire: 5,
    });
  }

  refreshUsers(): void {
    this.userService.invalidateCache('/users');
  }
}
```

## Comando `remove` (alias `rm`)

Apaga um artefacto gerado e remove as suas entradas do manifest. Mesmo `-t, --type` do `add`. Pede confirmação antes de apagar; para `component` remove a pasta inteira da feature (porque `--inline-template` / `--style` alteram que ficheiros existem).

```bash
npx ngx-base-cli remove user --type pipe
npx ngx-base-cli rm user --type component        # remove core/components/user/
npx ngx-base-cli remove order-status --type enum
```

Se nada corresponder no disco, o comando não faz nada e avisa.

## Comando `update`

Regenera os ficheiros do **`init`** com base em **`.ngx-base-cli.json`**, compara com o disco e mostra um **diff** colorido; pergunta confirmação antes de sobrescrever cada ficheiro alterado.

Útil após atualizar a versão do **ngx-base-cli** ou quando queres alinhar o código gerado com a config guardada.

```bash
npx ngx-base-cli update
```

Aplicar todas as atualizações sem prompts por ficheiro:

```bash
npx ngx-base-cli update --yes
# ou
npx ngx-base-cli update -y
```

Por predefinição, ficheiros que **editaste localmente** desde que o CLI os escreveu são detetados (via manifest) e **ignorados** para não perder as tuas alterações. Para os sobrescrever também, usa `-f, --force`:

```bash
npx ngx-base-cli update --force
```

## Comando `list`

Mostra o estado de sincronização de cada ficheiro que o `init` geraria, sem tocar no disco. Os estados vêm do manifest: **em sync**, **desatualizado** (output original do CLI que o template geraria agora de forma diferente), **editado localmente** ou **ausente**. O comando termina com **código não-zero** quando algum ficheiro está desatualizado ou ausente, podendo servir de gate em CI.

```bash
npx ngx-base-cli list
```

Exemplo de saída:

```
✅  src/app/core/interfaces/cache.interface.ts     presente, em sync
✅  src/app/core/services/cache.service.ts         presente, em sync
⚠️   src/app/core/services/base.service.ts          desatualizado
❌  src/app/core/interceptors/auth.interceptor.ts  ausente
```

Útil para auditar o estado do projeto antes de correr `update`.

O `list` termina sempre com código **0**, por isso é seguro em pipes. Usa
`--check` para o transformar num gate de CI — nesse caso termina com **1**
quando algum ficheiro está ausente ou desatualizado:

```bash
npx ngx-base-cli list --check
```

## Comando `doctor`

Valida o teu **setup** depois do `init` (enquanto o `list` valida os **ficheiros** gerados). Verifica:

- Ficheiros base presentes (`cache.interface.ts`, `cache.service.ts`, `base.service.ts`)
- `src/environments/environment.ts` e o par indicado por `environmentStyle`
- A versão do Angular instalada contra o `angularTarget` com que os ficheiros foram gerados
- Um opt-out do Zone.js (`provideZoneChangeDetection()`) em Angular 21+, onde zoneless é o defeito
- Aliases no `tsconfig.json` (`@core/*`, e `@layout/*` / `@pages/*` / `@shared/*` quando a estrutura base está ativada)
- `src/app/app.config.ts` liga `provideHttpClient(...)`, o provider `BASE_API_URL` e `withInterceptors(...)` quando há interceptors gerados
- O `AUTH_TOKEN` está fornecido quando o `AuthInterceptor` foi gerado

Termina com **código não-zero** quando alguma verificação é **erro**, podendo servir de gate em CI.

```bash
npx ngx-base-cli doctor
```

Exemplo de saída:

```
XX  cache.service.ts present
      Expected at src/app/core/services/cache.service.ts. Run `ngx-base-cli init`.
OK  base.service.ts present
!!  alias @core/*
      Add it to tsconfig.json compilerOptions.paths.
OK  provideHttpClient()
OK  BASE_API_URL provider
```

## Flags `--yes` / `--preset` (init)

Salta o wizard interativo completo e escolhe um preset:

```bash
npx ngx-base-cli init --yes             # pergunta o preset e corre sem mais interações
npx ngx-base-cli init --preset standard # totalmente automático (implica --yes)
```

| Preset | Descrição |
|--------|-----------|
| `minimal` | cache + base service apenas, localStorage, sem interceptors |
| `standard` | cache + base service + auth interceptor + error interceptor + barrel |
| `full` | standard + estrutura base de pastas (layout, pages, routes, shared) |

Seja qual for o preset, as definições que dependem da versão (`angularTarget`,
`fileNaming`, `environmentStyle`, `useHttpResource`) vêm da versão do Angular
detetada no `package.json`.

Quando o stdin não é um TTY (CI, pipes), o `init` nunca bloqueia num prompt: usa
o `--preset` se for indicado, senão `minimal`, aceita o patch dos aliases do
tsconfig, e não mexe em ficheiros já existentes.

## Flag `--dry-run` (init)

Pré-visualiza o que o `init` geraria sem escrever nenhum ficheiro no disco:

```bash
npx ngx-base-cli init --dry-run
```

## Opção `--cwd`

Executa o comando como se a raiz do projeto fosse outra pasta (útil em monorepos):

```bash
npx ngx-base-cli init --cwd ./apps/web
npx ngx-base-cli add users --cwd ./apps/web
npx ngx-base-cli update --cwd ./apps/web
```

## `.ngx-base-cli.json`

Ficheiro na **raiz do projeto Angular** (mesmo nível que `package.json`). Valores em falta são preenchidos com os predefinidos do CLI ao ler a config.

| Propriedade | Tipo | Predefinição | Descrição |
|-------------|------|--------------|-----------|
| `outputDir` | `string` | `src/app/core` | Pasta base dos ficheiros gerados |
| `baseApiUrl` | `string` | `https://api.example.com` | URL usada no exemplo de `BASE_API_URL` |
| `importStyle` | `"alias"` \| `"relative"` | `"alias"` | Estilo de import do modelo de cache |
| `useHttpResource` | `boolean` | `false` | `GET` com `httpResource` (Angular ≥ 19.1; estável na 22) |
| `storageEngine` | `string` | `"localStorage"` | `"localStorage"`, `"sessionStorage"` ou `"memory"` |
| `generateAuthInterceptor` | `boolean` | `false` | Gera `interceptors/auth.interceptor.ts` |
| `authTokenName` | `string` | `"AUTH_TOKEN"` | Nome do símbolo importado no interceptor |
| `authTokenImportPath` | `string` | `"@core/tokens"` | Caminho de import do token |
| `generateErrorInterceptor` | `boolean` | `false` | Gera `interceptors/error.interceptor.ts` |
| `generateLoggingInterceptor` | `boolean` | `false` | Gera `interceptors/logging.interceptor.ts` |
| `generateCacheInterceptor` | `boolean` | `false` | Gera `interceptors/cache.interceptor.ts` |
| `generateBarrel` | `boolean` | `true` | Gera `services/index.ts` |
| `generateProjectStructure` | `boolean` | `false` | Gera `layout/`, `pages/landing-page/`, `routes/`, `shared/` em `src/app` e subpastas vazias em `core/` (`directives`, `enum`, `guards`, `interceptors`, `pipes`, `utils`); cria/sobrescreve `app.routes.ts` |

## `.ngx-base-cli.manifest.json`

Além da config, o `init`, `add` e `update` mantêm **`.ngx-base-cli.manifest.json`** na raiz do projeto — um hash sha256 de cada ficheiro gerado. Isto permite ao `list` e `update` distinguir o output original do CLI de ficheiros que editaste à mão (para os ignorar no update). Seguro para commit; não editar à mão.

## Desenvolvimento local (repositório do CLI)

```bash
npm install
npm run build
node dist/index.js init
```

Durante o desenvolvimento podes usar:

```bash
npm run dev -- init
```

## Atualizar a partir da 0.1.0-beta.2

Os `.ngx-base-cli.json` existentes continuam a funcionar: as chaves novas têm
como predefinição o comportamento *antigo* (`fileNaming: "classic"`,
`environmentStyle: "prod"`, `generateSpecs: false`, `angularTarget: 0`), por
isso o `update` não vai reorganizar um projeto já configurado. Para aderir,
edita esses campos ou volta a correr o `init`.

Duas coisas mudam no código **gerado** no próximo `update`:

- **Formato do `CacheService`.** Chaves e valores deixaram de ser codificados em
  base64 (o `btoa` rebentava com URLs fora de Latin1 e só acrescentava tamanho).
  As entradas escritas pela versão anterior são ilegíveis e são descartadas no
  primeiro acesso; as chaves antigas ficam para trás sem efeito.
- **Assinatura do `CacheService.get`.** Passa a devolver `CacheEntry<T> | null`
  em vez do valor direto, para que um `0`/`""`/`false` em cache conte como hit e não
  como miss. Se chamas o `cacheService.get()` diretamente, lê o `.value`.
- **Formato do `AUTH_TOKEN`.** O `authInterceptor` gerado espera agora
  `InjectionToken<() => string | null>` (um getter, para suportar refresh) e só
  acrescenta o header a URLs pertencentes ao `BASE_API_URL`.

## Licença

MIT

</details>
