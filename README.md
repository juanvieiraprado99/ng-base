# ngx-base-cli

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/ngx-base-cli)](https://nodejs.org/)
[![npm](https://img.shields.io/npm/v/ngx-base-cli)](https://www.npmjs.com/package/ngx-base-cli)

> 🇵🇹 **Português:** [README.pt-PT.md](README.pt-PT.md)

CLI to scaffold an HTTP core for Angular projects — `ApiClient`, response cache (interceptor-based), auth token store + allowlisted auth interceptor, error/logging interceptors and an optional app structure. The workflow is inspired by [shadcn/ui](https://ui.shadcn.com): the code **lives in your repository** and you can customize it freely.

*Made with love by Juan for the Angular community <3*

## Prerequisites

- **Node.js** ≥ 18
- An **Angular** project with `package.json` at the root (where you run the command)
- If `@angular/core` is not found in `package.json`, the CLI will ask whether you want to continue anyway.
- For the **`httpResource`** option on `GET`: Angular **19.2+** (see the [documentation](https://angular.dev/guide/http/http-resource))

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
| `httpResource` on `GET` | Only if Angular ≥ **19.2** |
| `CacheService` engine | `localStorage` (default), `sessionStorage`, or `memory` (e.g. SSR) |
| HTTP interceptors | Multi-select: `AuthInterceptor` (Bearer), `ErrorInterceptor` (401/403/5xx), `LoggingInterceptor` (dev-only logging) |
| Barrel `services/index.ts` | Default **yes** |
| Base folder structure | Default **no**; generates `layout/`, `pages/`, `routes/`, `shared/` under `src/app` and subfolders under `core/` (`directives`, `enum`, `guards`, `interceptors`, `pipes`, `utils`) |
| Existing files | Asks whether to **overwrite** (default **no**; with `--yes` they are kept). `app.html` / `app.routes.ts` are never overwritten — routes are merged |

### Typical structure after `init`

With `outputDir` = `src/app/core` and optional interceptors:

```text
src/app/core/
├── interfaces/
│   └── cache.interface.ts
├── services/
│   ├── api-client.ts         # ApiClient — inject it in feature services
│   ├── cache.service.ts
│   ├── cache.storage.ts      # CACHE_STORAGE (local / session / memory)
│   ├── auth-token.store.ts   # with AuthInterceptor or project structure
│   └── index.ts              # if barrel was generated
├── tokens/
│   ├── api.tokens.ts         # BASE_API_URL
│   ├── routes.tokens.ts      # LOGIN_ROUTE / FORBIDDEN_ROUTE (error interceptor / guard)
│   └── auth.tokens.ts        # AUTH_ALLOWED_URLS, skipAuth() (with AuthInterceptor)
└── interceptors/
    ├── cache.interceptor.ts    # always (serves withCache() GETs)
    ├── auth.interceptor.ts     # optional
    ├── error.interceptor.ts    # optional
    └── logging.interceptor.ts  # optional
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
│   │   └── auth.guard.ts                # authGuard (CanMatchFn → LOGIN_ROUTE)
│   ├── interceptors/
│   ├── interfaces/
│   ├── pipes/
│   ├── services/
│   ├── tokens/
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
│   ├── private.routes.ts                # PRIVATE_ROUTES ('app', canMatch: [authGuard])
│   └── public.routes.ts                 # PUBLIC_ROUTES  (loads PublicComponent + landing)
├── shared/
└── app.routes.ts                        # PUBLIC_ROUTES + PRIVATE_ROUTES + '**' (merged into an existing file)
```

> `PrivateComponent` and `PublicComponent` act as **shells** for authenticated and public areas. Add your area-specific `header`/`sidebar` here and keep `<router-outlet />` for child routes. The route files use `@layout/*` and `@pages/*` aliases when `importStyle` is `alias`; if you decline the `tsconfig.json` patch (or pass `--no-tsconfig`) everything is generated with relative imports instead.

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

> Note: the `tsconfig.json` patch only inserts the missing `paths` entries — comments and formatting are preserved (the same goes for the `angular.json` `fileReplacements` patch). It does not add `baseUrl` (deprecated in TypeScript 6); paths are written relative to the tsconfig.

### 2. Environments and `angular.json` (production file replacements)

`init` generates:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

If `angular.json` exists, `init` also tries to ensure your production build replaces `environment.ts` with `environment.prod.ts` via `fileReplacements` (idempotent patch).

### 3. HTTP providers and `BASE_API_URL`

The **`BASE_API_URL`** token is generated in **`tokens/api.tokens.ts`**. `init` shows an example with relative imports from `src/app`; alternatively:

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { environment } from '../environments/environment';
import { BASE_API_URL } from '@core/tokens/api.tokens';
import { authInterceptor } from '@core/interceptors/auth.interceptor';
import { errorInterceptor } from '@core/interceptors/error.interceptor';
import { loggingInterceptor } from '@core/interceptors/logging.interceptor';
import { cacheInterceptor } from '@core/interceptors/cache.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor, loggingInterceptor, cacheInterceptor])),
    { provide: BASE_API_URL, useValue: environment.baseApiUrl },
  ],
};
```

`cacheInterceptor` is always generated and registered (keep it last). The others are only present if you generated them.

`init` can also patch `src/app/app.config.ts` automatically (imports + `provideHttpClient(...)` + `{ provide: BASE_API_URL, useValue: environment.baseApiUrl }`). `provideHttpClient(withInterceptors([...]))` is always added (`ApiClient` needs `HttpClient`; the cache interceptor is always registered), and an existing `withInterceptors([...])` list is merged. A legacy `BASE_API_URL` import from `cache.service` is moved to `tokens/api.tokens`.

### 4. Auth token (if you generated `AuthInterceptor`)

The CLI generates **`services/auth-token.store.ts`** — a signal-based store. Set the token after login and clear it on logout:

```typescript
const auth = inject(AuthTokenStore);
auth.set(response.accessToken); // after login
auth.clear();                   // on logout
```

The interceptor adds `Authorization: Bearer <token>` **only to URLs in `AUTH_ALLOWED_URLS`** (default: `BASE_API_URL`), matched by origin + path prefix — so the token never leaks to third-party or look-alike hosts (`api.example.com.attacker.io`). Allow more APIs, or opt a request out (login, refresh, public endpoints):

```typescript
// app.config.ts
{ provide: AUTH_ALLOWED_URLS, useValue: [environment.baseApiUrl, 'https://files.example.com/api'] },

// a request that must not carry the token
this.api.post('/auth/login', credentials, { context: skipAuth() });
```

`auth.clear()` also wipes the response cache, so the next user never sees cached data from the previous one. `authGuard` and the error interceptor redirect to `LOGIN_ROUTE` (default `/login`); override it in `providers`: `{ provide: LOGIN_ROUTE, useValue: '/auth/sign-in' }`. The store is in-memory — add persistence there if you need the session to survive a reload.

## Generated files — reference

### `services/api-client.ts` — `ApiClient`

Thin `HttpClient` wrapper that prefixes `BASE_API_URL` and exposes cache/retry as options. Use it by **composition** in your feature services (`inject(ApiClient)`), not inheritance.

```typescript
get<T>(endpoint: string, options?: GetOptions): Observable<T>
post<T>(endpoint: string, body: unknown, options?: RequestOptions): Observable<T>
put / patch  — same as post
delete<T>(endpoint: string, options?: RequestOptions & { body?: unknown }): Observable<T>
invalidateCache(endpoint: string, params?: QueryParams): void
url(endpoint: string): string   // absolute URL

interface RequestOptions { params?: HttpParams | Record<string, …>; headers?: …; context?: HttpContext }
interface GetOptions extends RequestOptions {
  cache?: boolean | { ttlMinutes?: number };  // true = 10 minutes
  retry?: number;                             // network errors / 5xx only, 500 ms apart
}
```

With `useHttpResource: true` (Angular ≥ 19.2) it also gets **`resource<T>(() => endpoint | undefined, { cache?, ...HttpResourceOptions })`**, returning `HttpResourceRef<T | undefined>` — call it in an injection context; return `undefined` to skip the request.

### `interceptors/cache.interceptor.ts`

Serves opted-in **GET** requests from `CacheService` and stores successful responses, keyed by `urlWithParams` (different query strings are cached separately; falsy bodies like `0` are cached too). Opt in through `ApiClient` (`{ cache: true }`) or from any `HttpClient` call:

```typescript
this.http.get('/api/countries', { context: withCache({ ttlMinutes: 60 }) });
```

### `services/cache.service.ts` + `services/cache.storage.ts`

- `CacheService`: `get<T>(key)`, `set(key, value, minutes)`, `remove(key)`, `clear()` — plain JSON entries under a `ngx-base-cli:` key prefix (Unicode-safe), with expiration.
- `CACHE_STORAGE`: the backing storage, chosen by `storageEngine` (`browserStorage("local")`, `browserStorage("session")` or `memoryStorage()`). Swap it in `providers` without re-running the CLI. With Web Storage, caching is a no-op on the server (SSR-safe).

### `interfaces/cache.interface.ts`

`CacheObject` (stored entry shape). `CacheOptions` is kept only so a legacy `base.service.ts` keeps compiling.

### Migrating from `BaseService` (≤ 0.1.0-beta.2)

`update` generates `api-client.ts` and leaves your old `base.service.ts` in place (it still compiles) with a warning. Then, per service:

```typescript
// before
export class UserService extends BaseService {}
this.userService.get('/users', { enabled: true, minutesToExpire: 5 }, 2, params);

// after
export class UserService {
  private readonly api = inject(ApiClient);
  list() { return this.api.get<User[]>('/users', { cache: { ttlMinutes: 5 }, retry: 2, params }); }
}
```

When nothing imports `BaseService` any more, delete `base.service.ts`.

## `add` command — feature artifacts

Generates a feature artifact under the configured `outputDir`. The artifact type is chosen with `-t, --type` (default **`service`**). Requires `.ngx-base-cli.json`.

| `--type` | Generated file(s) (`outputDir = src/app/core`) |
|----------|-------------------------------------------------|
| `service` (default) | `core/services/<kebab>.service.ts` (`inject(ApiClient)`, endpoint `/<kebab>`) |
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

> `service` also requires `api-client.ts` in the configured `outputDir` (run `init`/`update` first). With the default `outputDir`, `add user` lands at **`src/app/core/services/user.service.ts`**.

Example generated service file (`outputDir = src/app/core`):

```typescript
import { inject, Injectable } from '@angular/core';
import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiClient);
  private readonly endpoint = '/user';

  list<T = unknown>() {
    return this.api.get<T[]>(this.endpoint);
  }

  getById<T = unknown>(id: string | number) {
    return this.api.get<T>(`${this.endpoint}/${id}`);
  }
}
```

### Example usage in a component

```typescript
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiClient } from '@core/services/api-client';

@Component({
  selector: 'app-user-list',
  template: `...`,
})
export class UserListComponent {
  private readonly api = inject(ApiClient);

  readonly users = toSignal(
    this.api.get<User[]>('/users', { params: { page: 1, limit: 20 }, cache: true, retry: 2 }),
  );

  refreshUsers(): void {
    this.api.invalidateCache('/users', { page: 1, limit: 20 });
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
⚠️   src/app/core/services/api-client.ts            out of date
❌  src/app/core/interceptors/auth.interceptor.ts  absent
```

Useful to audit the project state before running `update`.

## `doctor` command

Validates your **setup** after `init` (where `list` validates generated **files**). It checks:

- Base files present (`cache.interface.ts`, `cache.service.ts`, `cache.storage.ts`, `api-client.ts`, `cache.interceptor.ts`, `tokens/api.tokens.ts`)
- `src/environments/environment.ts` and `environment.prod.ts`
- `tsconfig.json` path aliases (`@core/*`, and `@layout/*` / `@pages/*` / `@shared/*` when project structure is enabled)
- `src/app/app.config.ts` wires `provideHttpClient(...)`, the `BASE_API_URL` provider, and every generated interceptor (`cacheInterceptor` missing is an error)
- `AuthTokenStore` is present when `AuthInterceptor` or the project structure was generated

Exits with a **non-zero code** when any check is an **error**, so it can gate CI.

```bash
npx ngx-base-cli doctor
```

Output example:

```
XX  cache.service.ts present
      Expected at src/app/core/services/cache.service.ts. Run `ngx-base-cli init`.
OK  api-client.ts present
!!  alias @core/*
      Add it to tsconfig.json compilerOptions.paths.
OK  provideHttpClient()
OK  BASE_API_URL provider
```

## `--yes` flag (init)

Fully non-interactive (CI-friendly): no prompts at all. Pick the preset with `--preset` (defaults to `standard`); existing files are kept and the `tsconfig.json` aliases are added automatically (`--no-tsconfig` to skip them and generate relative imports):

```bash
npx ngx-base-cli init --preset full --yes
npx ngx-base-cli init -y                 # standard
npx ngx-base-cli init --preset minimal   # interactive confirm, no preset question
```

Presets:

| Preset | Description |
|--------|-------------|
| `minimal` | api client + cache (localStorage), only the cache interceptor |
| `standard` | minimal + auth interceptor (allowlist) + error interceptor + barrel |
| `full` | standard + base folder structure (layout, pages, routes, shared) |

## `--dry-run` flag (init)

Preview what `init` would generate without writing any file to disk:

```bash
npx ngx-base-cli init --dry-run
```

## Workspace and naming (`init --project`, `--naming`)

`init` reads `angular.json` to find the target application — `--project <name>`, else `defaultProject`, else the first `application` project — and uses its **`sourceRoot`** (app dir, environments, `app.config.ts`, `app.routes.ts`, `fileReplacements`) and **`prefix`** (selectors of generated components/directives). Multi-project workspaces work out of the box:

```bash
npx ngx-base-cli init --project admin --preset full --yes
# → projects/admin/src/app/core/…, selectors adm-*, fileReplacements only on "admin"
```

The chosen `project` is saved in `.ngx-base-cli.json`, so `add`, `update`, `list` and `doctor` target the same app.

**Naming convention.** `init` detects how the project names files and saves it as `naming`:

1. `angular.json` schematics with `type: "component"` / `type: "service"` (what `ng update` to v20 adds) → `suffixed`
2. existing `*.component.ts` files → `suffixed`; a suffixless `app.ts` → `modern`
3. otherwise Angular ≥ 20 → `modern`, older → `suffixed`

Override with `--naming modern|suffixed` (or pick it in the wizard).

| Artifact | `modern` (Angular v20+ style guide) | `suffixed` |
|----------|-------------------------------------|------------|
| component | `user-card/user-card.ts` · `UserCard` | `user-card/user-card.component.ts` · `UserCardComponent` |
| service | `user.ts` · `UserService` | `user.service.ts` · `UserService` |
| directive | `highlight.ts` · `Highlight` | `highlight.directive.ts` · `HighlightDirective` |
| pipe / guard / resolver / store | `truncate-pipe.ts`, `auth-guard.ts`, `user-resolver.ts`, `cart-store.ts` | `truncate.pipe.ts`, `auth.guard.ts`, `user.resolver.ts`, `cart.store.ts` |
| interface | `user.model.ts` · `User` | `user.interface.ts` · `User` |
| core files | `cache.ts`, `cache-storage.ts`, `api-tokens.ts`, `cache-interceptor.ts`, `cache.model.ts` | `cache.service.ts`, `cache.storage.ts`, `api.tokens.ts`, `cache.interceptor.ts`, `cache.interface.ts` |
| layouts / landing | `private-layout.ts` · `PrivateLayout`, `landing-page.ts` · `LandingPage` | `private.component.ts` · `PrivateComponent`, `landing-page.component.ts` · `LandingPageComponent` |

`api-client.ts`, `*.routes.ts` and `*.enum.ts` are the same in both. Configs created before this option existed have no `naming` key and keep `suffixed`, so `update` never renames your files.

## `--cwd` option

Runs the command as if the project root were another folder (useful in monorepos):

```bash
npx ngx-base-cli init --cwd ./apps/web
npx ngx-base-cli add users --cwd ./apps/web
npx ngx-base-cli update --cwd ./apps/web
```

## `.ngx-base-cli.json`

File at the **Angular project root** (same level as `package.json`). Missing values are filled with CLI defaults when the config is read; invalid values fall back to the default with a warning.

`init` writes a `"$schema": "https://unpkg.com/ngx-base-cli/schema.json"` entry, so VS Code and other editors autocomplete and validate the file. The schema is also shipped in the package (`node_modules/ngx-base-cli/schema.json`).

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `outputDir` | `string` | `src/app/core` | Base folder for generated files |
| `baseApiUrl` | `string` | `https://api.example.com` | URL used in the `BASE_API_URL` example |
| `importStyle` | `"alias"` \| `"relative"` | `"alias"` | Import style for the cache model |
| `useHttpResource` | `boolean` | `false` | `GET` with `httpResource` (Angular ≥ 19.2) |
| `storageEngine` | `string` | `"localStorage"` | `"localStorage"`, `"sessionStorage"`, or `"memory"` |
| `generateAuthInterceptor` | `boolean` | `false` | Generates `interceptors/auth.interceptor.ts` |
| `authTokenName` / `authTokenImportPath` | `string` | — | **Deprecated** — ignored; the interceptor reads `AuthTokenStore` |
| `generateErrorInterceptor` | `boolean` | `false` | Generates `interceptors/error.interceptor.ts` |
| `generateLoggingInterceptor` | `boolean` | `false` | Generates `interceptors/logging.interceptor.ts` |
| `generateBarrel` | `boolean` | `true` | Generates `services/index.ts` |
| `generateProjectStructure` | `boolean` | `false` | Generates `layout/`, `pages/landing-page/`, `routes/`, `shared/` under `src/app` and empty subfolders under `core/` (`directives`, `enum`, `guards`, `interceptors`, `pipes`, `utils`); creates `app.routes.ts` / `app.html` only when missing (otherwise merges routes) |
| `naming` | `"modern"` \| `"suffixed"` | detected by `init` (`"suffixed"` when missing) | File/class naming convention (see *Workspace and naming*) |
| `project` | `string` | resolved by `init` | `angular.json` project to target; `init` saves the detected one so a later `angular.json` change cannot retarget the CLI. Empty = auto-detect |

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

Checks (the same ones CI runs):

```bash
npm run check && npm run typecheck && npm test   # lint, types, unit + integration tests
npm run e2e                                       # ng new → init → ng build (needs network)
npm run e2e -- modern-full                        # a single scenario (also: suffixed-relative-ssr)
npm run schema                                    # regenerate schema.json after changing CONFIG_FIELDS
```

## License

MIT
