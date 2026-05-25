# ngx-base-cli

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/ngx-base-cli)](https://nodejs.org/)
[![npm](https://img.shields.io/npm/v/ngx-base-cli)](https://www.npmjs.com/package/ngx-base-cli)

> Portuguese documentation is at the **bottom** of this file — expand **Versão em Português**.

CLI to scaffold `BaseService`, `CacheService`, cache models, and (optionally) HTTP interceptors in Angular projects. The workflow is inspired by [shadcn/ui](https://ui.shadcn.com): the code **lives in your repository** and you can customize it freely.

*Made with love by Juan for the Angular community <3*

## Prerequisites

- **Node.js** ≥ 18
- An **Angular** project with `package.json` at the root (where you run the command)
- If `@angular/core` is not found in `package.json`, the CLI will ask whether you want to continue anyway.
- For the **`httpResource`** option on `GET`: Angular **19.1+** (`httpResource` is experimental; see the [documentation](https://angular.dev/guide/signals/resource))

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
| `httpResource` on `GET` | Only if Angular ≥ **19.1**; default **yes** when available (experimental API) |
| `CacheService` engine | `localStorage` (default), `sessionStorage`, or `memory` (e.g. SSR) |
| HTTP interceptors | Multi-select: `AuthInterceptor` (Bearer), `ErrorInterceptor` (401/403/5xx), `LoggingInterceptor` (dev-only logging) |
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
└── environment.prod.ts
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

### 2. Environments and `angular.json` (production file replacements)

`init` generates:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

If `angular.json` exists, `init` also tries to ensure your production build replaces `environment.ts` with `environment.prod.ts` via `fileReplacements` (idempotent patch).

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

Defines `CacheObject` and `CacheOptions`:

```typescript
export interface CacheOptions {
  enabled?: boolean;
  minutesToExpire?: number;
}
```

### `services/cache.service.ts`

- Persistence according to the chosen engine: **localStorage**, **sessionStorage**, or **memory** (`Map`).
- Internal keys with prefix and endpoint encoding; supports expiration in minutes.
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

- **Cache:** pass `{ enabled: true, minutesToExpire: 10 }` in `cacheOptions` (the default minutes value is also applied via `HttpContext` on requests).
- **Query string:** use the 4th argument with `HttpParams` (the 2nd is always cache options, not a query object).

```typescript
import { HttpParams } from '@angular/common/http';

const params = new HttpParams().set('page', '1').set('limit', '20');
this.myService.get<Item[]>('/items', {}, 0, params).subscribe(/* ... */);
```

There are also `post`, `put`, `patch`, `delete` with `HttpClient` and `take(1)` where applicable.

**Note:** `CACHE_ENABLED` and `CACHE_MINUTES_TO_EXPIRE` are `HttpContextToken`s exported from `BaseService`; caching is applied in the `get` `tap`, not by an interceptor that reads those tokens automatically.

### `services/base.service.ts` (`httpResource` mode, Angular ≥ 19.1)

- The `get` method uses `httpResource` and returns **`HttpResourceRef<T>`**.
- Does **not** inject `CacheService` or use `CacheOptions` in this mode.
- `post`, `put`, `patch`, `delete` remain `Observable`-based as in classic mode.

## `add` command — feature artifacts

Generates a feature artifact under the configured `outputDir`. The artifact type is chosen with `-t, --type` (default **`service`**). Requires `.ngx-base-cli.json`.

| `--type` | Generated file(s) (`outputDir = src/app/core`) |
|----------|-------------------------------------------------|
| `service` (default) | `core/services/<kebab>.service.ts` (extends `BaseService`) |
| `component` | `core/components/<kebab>/<kebab>.component.ts` (+ `.html` / stylesheet) |
| `guard` | `core/guards/<kebab>.guard.ts` (functional `CanActivateFn`) |
| `resolver` | `core/resolvers/<kebab>.resolver.ts` (functional `ResolveFn`) |
| `pipe` | `core/pipes/<kebab>.pipe.ts` (`PipeTransform`, `name: '<camel>'`) |
| `directive` | `core/directives/<kebab>.directive.ts` (`selector: '[app<Pascal>]'`) |
| `interface` | `core/interfaces/<kebab>.interface.ts` (`export interface <Pascal>`) |
| `store` | `core/stores/<kebab>.store.ts` (signal-based store) |
| `enum` | `core/enum/<kebab>.enum.ts` (`export enum <Pascal>`) |

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

## `doctor` command

Validates your **setup** after `init` (where `list` validates generated **files**). It checks:

- Base files present (`cache.interface.ts`, `cache.service.ts`, `base.service.ts`)
- `src/environments/environment.ts` and `environment.prod.ts`
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

## `--yes` flag (init)

Skip the full interactive wizard and pick a preset instead:

```bash
npx ngx-base-cli init --yes
# or
npx ngx-base-cli init -y
```

You are asked a **single question** — which preset to apply — and then the wizard runs without further prompts:

| Preset | Description |
|--------|-------------|
| `minimal` | cache + base service only, localStorage, no interceptors |
| `standard` | cache + base service + auth interceptor + error interceptor + barrel |
| `full` | standard + base folder structure (layout, pages, routes, shared) |

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
| `useHttpResource` | `boolean` | `false` | `GET` with `httpResource` (Angular ≥ 19.1) |
| `storageEngine` | `string` | `"localStorage"` | `"localStorage"`, `"sessionStorage"`, or `"memory"` |
| `generateAuthInterceptor` | `boolean` | `false` | Generates `interceptors/auth.interceptor.ts` |
| `authTokenName` | `string` | `"AUTH_TOKEN"` | Imported symbol name in the interceptor |
| `authTokenImportPath` | `string` | `"@core/tokens"` | Import path for the token |
| `generateErrorInterceptor` | `boolean` | `false` | Generates `interceptors/error.interceptor.ts` |
| `generateLoggingInterceptor` | `boolean` | `false` | Generates `interceptors/logging.interceptor.ts` |
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

## License

MIT

<details>
<summary><strong>Versão em Português</strong></summary>

CLI para gerar `BaseService`, `CacheService`, modelos de cache e (opcionalmente) interceptors HTTP em projetos Angular. O fluxo inspira-se no [shadcn/ui](https://ui.shadcn.com): o código **fica no teu repositório** e podes ajustar à vontade.

*Criado pelo Juan para a comunidade Angular <3*

## Pré-requisitos

- **Node.js** ≥ 18
- Projeto **Angular** com `package.json` na raiz (onde corres o comando)
- Se `@angular/core` não for encontrado no `package.json`, o CLI pergunta se queres continuar na mesma.
- Para a opção **`httpResource`** no `GET`: Angular **19.1+** (`httpResource` é experimental; ver [documentação](https://angular.dev/guide/signals/resource))

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
| `httpResource` no `GET` | Só se Angular ≥ **19.1**; predefinição **sim** quando disponível (API experimental) |
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
└── environment.prod.ts
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

### 2. Environments e `angular.json` (file replacements em produção)

O `init` gera:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

Se existir `angular.json`, o `init` também tenta garantir que a build de produção faz replace de `environment.ts` por `environment.prod.ts` via `fileReplacements` (patch idempotente).

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

| `--type` | Ficheiro(s) gerado(s) (`outputDir = src/app/core`) |
|----------|----------------------------------------------------|
| `service` (predefinido) | `core/services/<kebab>.service.ts` (estende `BaseService`) |
| `component` | `core/components/<kebab>/<kebab>.component.ts` (+ `.html` / folha de estilos) |
| `guard` | `core/guards/<kebab>.guard.ts` (`CanActivateFn` funcional) |
| `resolver` | `core/resolvers/<kebab>.resolver.ts` (`ResolveFn` funcional) |
| `pipe` | `core/pipes/<kebab>.pipe.ts` (`PipeTransform`, `name: '<camel>'`) |
| `directive` | `core/directives/<kebab>.directive.ts` (`selector: '[app<Pascal>]'`) |
| `interface` | `core/interfaces/<kebab>.interface.ts` (`export interface <Pascal>`) |
| `store` | `core/stores/<kebab>.store.ts` (store baseada em signals) |
| `enum` | `core/enum/<kebab>.enum.ts` (`export enum <Pascal>`) |

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

## Comando `doctor`

Valida o teu **setup** depois do `init` (enquanto o `list` valida os **ficheiros** gerados). Verifica:

- Ficheiros base presentes (`cache.interface.ts`, `cache.service.ts`, `base.service.ts`)
- `src/environments/environment.ts` e `environment.prod.ts`
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

## Flag `--yes` (init)

Salta o wizard interativo completo e escolhe um preset:

```bash
npx ngx-base-cli init --yes
# ou
npx ngx-base-cli init -y
```

É feita **uma única pergunta** — qual preset aplicar — e o wizard corre sem mais interações:

| Preset | Descrição |
|--------|-----------|
| `minimal` | cache + base service apenas, localStorage, sem interceptors |
| `standard` | cache + base service + auth interceptor + error interceptor + barrel |
| `full` | standard + estrutura base de pastas (layout, pages, routes, shared) |

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
| `useHttpResource` | `boolean` | `false` | `GET` com `httpResource` (Angular ≥ 19.1) |
| `storageEngine` | `string` | `"localStorage"` | `"localStorage"`, `"sessionStorage"` ou `"memory"` |
| `generateAuthInterceptor` | `boolean` | `false` | Gera `interceptors/auth.interceptor.ts` |
| `authTokenName` | `string` | `"AUTH_TOKEN"` | Nome do símbolo importado no interceptor |
| `authTokenImportPath` | `string` | `"@core/tokens"` | Caminho de import do token |
| `generateErrorInterceptor` | `boolean` | `false` | Gera `interceptors/error.interceptor.ts` |
| `generateLoggingInterceptor` | `boolean` | `false` | Gera `interceptors/logging.interceptor.ts` |
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

## Licença

MIT

</details>
