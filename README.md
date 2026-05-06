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
- For the **`httpResource`** option on `GET`: Angular **19.1+** (`httpResource` is experimental; see the [documentation](https://angular.dev/guide/signals/resource))

## Quick install

At your Angular project root:

```bash
npx ngx-base-cli@latest init
```

Pre-release versions (`alpha` tag):

```bash
npx ngx-base-cli@alpha init
```

The flow is **interactive**. When finished, **`.ngx-base-cli.json`** is created at the root — required for `add` and `update`.

### `init` prompts (summary)

| Prompt | Default / notes |
|--------|-----------------|
| `BASE_API_URL` | `https://api.example.com` (must start with `http://` or `https://`) |
| Output directory | `src/app/core` (**relative** path from the project root) |
| `cache.interface` imports | **Alias** (`@core/interfaces/...`) or **relative** (`../interfaces/...`) |
| `httpResource` on `GET` | Only if Angular ≥ **19.1**; default **yes** when available (experimental API) |
| `CacheService` engine | `localStorage` (default), `sessionStorage`, or `memory` (e.g. SSR) |
| `AuthInterceptor` (Bearer) | Default **no**; if yes: token name (e.g. `AUTH_TOKEN`) and import path (e.g. `@core/tokens`) |
| `ErrorInterceptor` (401/403/5xx) | Default **no** |
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
    └── error.interceptor.ts
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

### 2. HTTP providers and `BASE_API_URL`

The **`BASE_API_URL`** token is generated in **`cache.service.ts`** (not in `BaseService`). `init` shows an example with relative imports from `src/app`; alternatively:

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { BASE_API_URL } from '@core/services/cache.service';
import { authInterceptor } from '@core/interceptors/auth.interceptor';
import { errorInterceptor } from '@core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    { provide: BASE_API_URL, useValue: 'https://api.example.com' },
  ],
};
```

If you **did not** generate interceptors, use only `provideHttpClient()` and the `BASE_API_URL` provider.

### 3. Auth token (if you generated `AuthInterceptor`)

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

## `add` command — feature service

Generates `src/app/features/<kebab-name>/<kebab-name>.service.ts` extending `BaseService`. Requires `.ngx-base-cli.json` and `base.service.ts` in the configured `outputDir`.

```bash
npx ngx-base-cli add user
npx ngx-base-cli add product-catalog
```

Example generated file (relative imports computed by the CLI):

```typescript
import { Injectable } from '@angular/core';
import { BaseService } from '../../../core/services/base.service';

@Injectable({ providedIn: 'root' })
export class UserService extends BaseService {}
```

### Example usage in a component

```typescript
import { Component, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { UserService } from '../features/user/user.service';

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
}
```

## `update` command

Regenerates **`init`** files from **`.ngx-base-cli.json`**, compares with disk, and shows a **colored diff**; asks for confirmation before overwriting each changed file.

Useful after upgrading **ngx-base-cli** or when you want generated code to match the saved config.

```bash
npx ngx-base-cli update
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
| `generateBarrel` | `boolean` | `true` | Generates `services/index.ts` |
| `generateProjectStructure` | `boolean` | `false` | Generates `layout/`, `pages/landing-page/`, `routes/`, `shared/` under `src/app` and empty subfolders under `core/` (`directives`, `enum`, `guards`, `interceptors`, `pipes`, `utils`); creates/overwrites `app.routes.ts` |

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
| `BASE_API_URL` | `https://api.example.com` (deve começar por `http://` ou `https://`) |
| Diretório de saída | `src/app/core` (caminho **relativo** à raiz do projeto) |
| Imports de `cache.interface` | **Alias** (`@core/interfaces/...`) ou **relativo** (`../interfaces/...`) |
| `httpResource` no `GET` | Só se Angular ≥ **19.1**; predefinição **sim** quando disponível (API experimental) |
| Motor do `CacheService` | `localStorage` (predefinido), `sessionStorage` ou `memory` (ex.: SSR) |
| `AuthInterceptor` (Bearer) | Predefinição **não**; se sim: nome do token (ex. `AUTH_TOKEN`) e caminho de import (ex. `@core/tokens`) |
| `ErrorInterceptor` (401/403/5xx) | Predefinição **não** |
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
    └── error.interceptor.ts
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

### 2. Providers HTTP e `BASE_API_URL`

O token **`BASE_API_URL`** é gerado em **`cache.service.ts`** (não no `BaseService`). O próprio `init` mostra um exemplo com imports relativos a partir de `src/app`; em alternativa:

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { BASE_API_URL } from '@core/services/cache.service';
import { authInterceptor } from '@core/interceptors/auth.interceptor';
import { errorInterceptor } from '@core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    { provide: BASE_API_URL, useValue: 'https://api.example.com' },
  ],
};
```

Se **não** geraste interceptors, usa apenas `provideHttpClient()` e o provider de `BASE_API_URL`.

### 3. Token de autenticação (se geraste `AuthInterceptor`)

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

## Comando `add` — serviço de feature

Gera `src/app/features/<nome-kebab>/<nome-kebab>.service.ts` a estender `BaseService`. Exige `.ngx-base-cli.json` e `base.service.ts` no `outputDir` configurado.

```bash
npx ngx-base-cli add user
npx ngx-base-cli add product-catalog
```

Exemplo de ficheiro gerado (imports relativos calculados pelo CLI):

```typescript
import { Injectable } from '@angular/core';
import { BaseService } from '../../../core/services/base.service';

@Injectable({ providedIn: 'root' })
export class UserService extends BaseService {}
```

### Exemplo de uso num componente

```typescript
import { Component, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { UserService } from '../features/user/user.service';

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
}
```

## Comando `update`

Regenera os ficheiros do **`init`** com base em **`.ngx-base-cli.json`**, compara com o disco e mostra um **diff** colorido; pergunta confirmação antes de sobrescrever cada ficheiro alterado.

Útil após atualizar a versão do **ngx-base-cli** ou quando queres alinhar o código gerado com a config guardada.

```bash
npx ngx-base-cli update
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
| `generateBarrel` | `boolean` | `true` | Gera `services/index.ts` |
| `generateProjectStructure` | `boolean` | `false` | Gera `layout/`, `pages/landing-page/`, `routes/`, `shared/` em `src/app` e subpastas vazias em `core/` (`directives`, `enum`, `guards`, `interceptors`, `pipes`, `utils`); cria/sobrescreve `app.routes.ts` |

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
