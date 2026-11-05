# ng-base

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/ng-base)](https://nodejs.org/)
[![npm](https://img.shields.io/npm/v/ng-base)](https://www.npmjs.com/package/ng-base)

> 🇵🇹 **Português:** [README.pt-PT.md](README.pt-PT.md)

Copy an HTTP core into your Angular app — `ApiClient`, response cache, `BASE_API_URL` — and add **modules** (auth, errors, logging, layout) one command at a time. Like [shadcn/ui](https://ui.shadcn.com): the code is **copied into your repository and belongs to you**. ng-base never syncs or regenerates it; edit it however you like.

*Made with love by Juan for the Angular community <3*

```bash
npx ng-base init          # the core
npx ng-base add auth      # + a module
npx ng-base list          # what is available / installed
```

## Prerequisites

- **Node.js** ≥ 20
- An **Angular** project (run the commands at its root, next to `package.json`)
- `ApiClient.resource()` (`httpResource`) is added automatically on Angular **19.2+**

## `init` — the core

```bash
npx ng-base@latest init
```

Asks two things — the API base URL and where cached responses live (`localStorage`, `sessionStorage` or `memory`) — then lets you pick modules to add right away. Everything else is detected from `angular.json` and the project: target app, `sourceRoot`, selector prefix, file naming convention, path aliases.

It writes:

```text
src/environments/environment.ts, environment.prod.ts   # baseApiUrl
src/app/core/
├── services/api-client.ts          # ApiClient — inject it in feature services
├── services/cache.service.ts       # CacheService
├── services/cache.storage.ts       # CACHE_STORAGE (local / session / memory, SSR-safe)
├── interfaces/cache.interface.ts
├── tokens/api.tokens.ts            # BASE_API_URL
└── interceptors/cache.interceptor.ts
.ng-base.json                       # settings + installed modules
```

and wires the project (AST/JSONC patches that keep your formatting and comments):

- `app.config.ts`: `provideHttpClient(withInterceptors([cacheInterceptor]))` and `{ provide: BASE_API_URL, useValue: environment.baseApiUrl }`
- `angular.json`: production `fileReplacements` for the environment file
- `tsconfig.json`: the `@core/*` path alias (skip with `--no-tsconfig` → relative imports)

Non-interactive (CI, scripts):

```bash
npx ng-base init --yes --api-url https://api.acme.dev --storage memory --with auth,errors
npx ng-base init --yes --all          # core + every module
```

| Flag | Description |
|------|-------------|
| `--api-url <url>` | `BASE_API_URL` written to the environments |
| `--storage local\|session\|memory` | cache storage |
| `-w, --with <modules>` / `--all` | add modules right away |
| `--naming auto\|modern\|suffixed` | file naming (default: detected) |
| `--no-tsconfig` | don't touch `tsconfig.json`; relative imports |
| `--project <name>` | `angular.json` project (multi-project workspaces) |
| `-y, --yes` | no prompts; existing files are kept |
| `--overwrite` | replace files that already exist |
| `--dry-run` | show what would be written |

## `add` — modules

```bash
npx ng-base add auth errors      # one or more
npx ng-base add                  # pick from a list
```

| Module | Files (in `core/` unless noted) | Wiring |
|--------|----------------------------------|--------|
| **auth** | `tokens/auth.tokens.ts` (`AUTH_ALLOWED_URLS`, `skipAuth()`, `LOGIN_ROUTE`), `services/auth-token.store.ts`, `interceptors/auth.interceptor.ts`, `guards/auth.guard.ts` | `authInterceptor` first in `withInterceptors` |
| **errors** | `interceptors/error.interceptor.ts` (`HttpErrorBus`, `FORBIDDEN_ROUTE`) | `errorInterceptor` after auth |
| **logging** | `interceptors/logging.interceptor.ts` (dev only) | `loggingInterceptor` after errors |
| **layout** | `layout/{public,private}/`, `pages/landing-page/`, `routes/{public,private}.routes.ts` (in `src/app`) | routes merged into `app.routes.ts`; `@layout/@pages/@shared` aliases |

Modules are **independent**: each imports only from the core and from itself, so they can be added in any order. Interceptors are inserted at their canonical position (auth → errors → logging → cache last); interceptors you added yourself stay where they are. If `app.config.ts` was restructured and can't be patched, `add` prints the snippet to paste.

Files that already exist are **never replaced** without `--overwrite` (or a yes to the prompt); re-adding an installed module is a no-op. `--dry-run` shows the plan.

**auth after layout:** the private route was generated without a guard (with a `// TODO`); `add auth` doesn't rewrite your routes, it reminds you to add `canMatch: [authGuard]`. Added in the other order, the guard is already there.

## `generate service`

```bash
npx ng-base generate service user --endpoint /users     # alias: ng-base g service user
```

Writes `core/services/user.ts` (or `user.service.ts`) — a `UserService` that uses `inject(ApiClient)`. For components, pipes, directives etc. use `ng generate`.

## `list` and `doctor`

- `list` (`ls`): every module, whether it is installed, and the command to add it.
- `doctor`: checks the files of each installed module, the environments, the path aliases and the `app.config.ts` providers/interceptors. Moved or deleted files are warnings — it's your code.

## Using the generated code

### `ApiClient`

Thin `HttpClient` wrapper that prefixes `BASE_API_URL` and exposes cache/retry as options. Use it by **composition** in feature services:

```typescript
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiClient);
  list() { return this.api.get<User[]>('/users', { cache: { ttlMinutes: 5 }, retry: 2 }); }
}
```

```typescript
get<T>(endpoint, options?: { params?, headers?, context?, cache?: boolean | { ttlMinutes? }, retry?: number }): Observable<T>
post / put / patch<T>(endpoint, body, options?): Observable<T>
delete<T>(endpoint, options?: { …, body? }): Observable<T>
resource<T>(() => endpoint | undefined, options?)   // httpResource, Angular 19.2+
invalidateCache(endpoint, params?): void
url(endpoint): string     // absolute URLs are kept; base + endpoint joined with one '/'
```

`retry` only retries network errors and 5xx (500 ms apart). `cache: true` = 10 minutes.

### Cache

`cacheInterceptor` serves opted-in **GET** JSON responses from `CacheService`, keyed by `urlWithParams`. Opt in through `ApiClient` (`{ cache: true }`) or any `HttpClient` call:

```typescript
this.http.get('/api/countries', { context: withCache({ ttlMinutes: 60 }) });
```

`CACHE_STORAGE` picks the backend (`browserStorage("local" | "session")` or `memoryStorage()`); swap it in `providers`. With Web Storage the cache is a no-op on the server (SSR-safe).

### Auth (`add auth`)

```typescript
const auth = inject(AuthTokenStore);
auth.set(response.accessToken); // after login — also drops the cache when the token changes
auth.clear();                   // on logout — drops the token and the cache
```

The interceptor adds `Authorization: Bearer <token>` **only to URLs in `AUTH_ALLOWED_URLS`** (default: `BASE_API_URL`), matched by origin + path prefix — never to third-party or look-alike hosts. A **401 on a request it authenticated** clears the token and redirects to `LOGIN_ROUTE` (default `/login`) with `returnUrl`; 401s from other APIs or `skipAuth()` calls (e.g. a failed login) are just re-thrown.

```typescript
// app.config.ts
{ provide: AUTH_ALLOWED_URLS, useValue: [environment.baseApiUrl, 'https://files.example.com/api'] },
{ provide: LOGIN_ROUTE, useValue: '/auth/sign-in' },

// a request that must not carry the token
this.api.post('/auth/login', credentials, { context: skipAuth() });
```

The store is in-memory — add persistence there if the session must survive a reload.

### Errors (`add errors`)

403 → `FORBIDDEN_ROUTE` (default `/forbidden`); 5xx → `inject(HttpErrorBus).serverErrors$` (toasts, logging). Errors are always re-thrown.

## Naming and workspaces

`init` targets the `angular.json` project from `--project`, else `defaultProject`, else the first application, and saves it in `.ng-base.json`. It detects the naming convention — `angular.json` schematics with `type: "component"`, existing `*.component.ts` files → `suffixed`; a suffixless `app.ts` or Angular ≥ 20 → `modern`:

| | `modern` (Angular v20+ style guide) | `suffixed` |
|-|-------------------------------------|------------|
| core | `cache.ts`, `cache-storage.ts`, `api-tokens.ts`, `cache-interceptor.ts` | `cache.service.ts`, `cache.storage.ts`, `api.tokens.ts`, `cache.interceptor.ts` |
| layout | `private-layout.ts` · `PrivateLayout` | `private.component.ts` · `PrivateComponent` |
| service | `user.ts` · `UserService` | `user.service.ts` · `UserService` |

Use `--cwd <dir>` on any command to run it against another folder (monorepos).

## `.ng-base.json`

Settings `add` and `generate` need to write code that matches what `init` wrote. It has a `$schema` for editor autocomplete.

| Property | Default | Description |
|----------|---------|-------------|
| `outputDir` | `src/app/core` | where the core lives |
| `baseApiUrl` | `https://api.example.com` | written to the environments |
| `importStyle` | `alias` | `alias` (`@core/…`) or `relative` |
| `useHttpResource` | Angular ≥ 19.2 | `ApiClient.resource()` |
| `storageEngine` | `localStorage` | `localStorage`, `sessionStorage`, `memory` |
| `naming` | detected | `modern` or `suffixed` |
| `project` | detected | `angular.json` project |
| `modules` | `[]` | installed modules |

## Upgrading from ngx-base-cli 0.1

The package was renamed **ngx-base-cli → ng-base**. The first `ng-base` command in a project converts `.ngx-base-cli.json` into `.ng-base.json` (`generate*Interceptor` / `generateProjectStructure` flags become `modules`) and removes the old file. `.ngx-base-cli.manifest.json` is no longer used — delete it. `update`, `remove` and the `add <name> --type …` generators are gone: the code is yours after install, and `ng generate` covers components, pipes and directives. `init --preset` still works (deprecated) and maps to `--with`.

## Local development

```bash
npm install
npm run dev -- init --cwd ../my-app      # run from source
npm run check && npm run typecheck && npm test
npm run e2e                               # ng new → init → add → ng build (network)
npm run e2e -- modern                     # one scenario (also: suffixed-relative-ssr)
npm run schema                            # regenerate schema.json after changing CONFIG_FIELDS
```

## License

MIT
