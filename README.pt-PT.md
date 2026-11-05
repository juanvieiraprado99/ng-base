# ngx-base-cli

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/ngx-base-cli)](https://nodejs.org/)
[![npm](https://img.shields.io/npm/v/ngx-base-cli)](https://www.npmjs.com/package/ngx-base-cli)

> 🇬🇧 **English:** [README.md](README.md)

CLI para gerar um núcleo HTTP em projetos Angular — `ApiClient`, cache de respostas (via interceptor), store de token + auth interceptor com allowlist, interceptors de erro/logging e uma estrutura de app opcional. O fluxo inspira-se no [shadcn/ui](https://ui.shadcn.com): o código **fica no teu repositório** e podes ajustar à vontade.

*Criado pelo Juan para a comunidade Angular <3*

## Pré-requisitos

- **Node.js** ≥ 18
- Projeto **Angular** com `package.json` na raiz (onde corres o comando)
- Se `@angular/core` não for encontrado no `package.json`, o CLI pergunta se queres continuar na mesma.
- Para a opção **`httpResource`** no `GET`: Angular **19.2+** (ver [documentação](https://angular.dev/guide/http/http-resource))

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
| `httpResource` no `GET` | Só se Angular ≥ **19.2** |
| Motor do `CacheService` | `localStorage` (predefinido), `sessionStorage` ou `memory` (ex.: SSR) |
| Interceptors HTTP | Multi-select: `AuthInterceptor` (Bearer), `ErrorInterceptor` (401/403/5xx), `LoggingInterceptor` (logs só em dev) |
| Barrel `services/index.ts` | Predefinição **sim** |
| Estrutura base de pastas | Predefinição **não**; gera `layout/`, `pages/`, `routes/`, `shared/` em `src/app` e subpastas em `core/` (`directives`, `enum`, `guards`, `interceptors`, `pipes`, `utils`) |
| Ficheiros já existentes | Pergunta se queres **sobrescrever** (predefinição **não**; com `--yes` são mantidos). `app.html` / `app.routes.ts` nunca são sobrescritos — as rotas são integradas |

### Estrutura típica após `init`

Com `outputDir` = `src/app/core` e interceptors opcionais:

```text
src/app/core/
├── interfaces/
│   └── cache.interface.ts
├── services/
│   ├── api-client.ts         # ApiClient — inject it in feature services
│   ├── cache.service.ts
│   ├── cache.storage.ts      # CACHE_STORAGE (local / session / memory)
│   ├── auth-token.store.ts   # com AuthInterceptor ou estrutura de pastas
│   └── index.ts              # se geraste barrel
├── tokens/
│   ├── api.tokens.ts         # BASE_API_URL
│   ├── routes.tokens.ts      # LOGIN_ROUTE / FORBIDDEN_ROUTE (error interceptor / guard)
│   └── auth.tokens.ts        # AUTH_ALLOWED_URLS, skipAuth() (with AuthInterceptor)
└── interceptors/
    ├── cache.interceptor.ts    # sempre (serve os GET com withCache())
    ├── auth.interceptor.ts     # opcional
    ├── error.interceptor.ts    # opcional
    └── logging.interceptor.ts  # opcional
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

> Os componentes `PrivateComponent` e `PublicComponent` servem de **shell** para áreas logada e deslogada. Adiciona aqui o teu `header`/`sidebar` específico de cada área e mantém o `<router-outlet />` para os filhos. Os ficheiros de rotas usam aliases `@layout/*` e `@pages/*` quando `importStyle` é `alias`; se recusares o patch do `tsconfig.json` (ou usares `--no-tsconfig`) tudo é gerado com imports relativos.

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

> Nota: o patch do `tsconfig.json` só insere as entradas de `paths` em falta — comentários e formatação são preservados (o mesmo vale para o patch de `fileReplacements` no `angular.json`). Não adiciona `baseUrl` (obsoleto no TypeScript 6); os paths são relativos ao tsconfig.

### 2. Environments e `angular.json` (file replacements em produção)

O `init` gera:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

Se existir `angular.json`, o `init` também tenta garantir que a build de produção faz replace de `environment.ts` por `environment.prod.ts` via `fileReplacements` (patch idempotente).

### 3. Providers HTTP e `BASE_API_URL`

O token **`BASE_API_URL`** é gerado em **`tokens/api.tokens.ts`**. O próprio `init` mostra um exemplo com imports relativos a partir de `src/app`; em alternativa:

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

O `cacheInterceptor` é sempre gerado e registado (mantém-no em último). Os outros só existem se os geraste.

O `init` também pode patchar automaticamente `src/app/app.config.ts` (imports + `provideHttpClient(...)` + `{ provide: BASE_API_URL, useValue: environment.baseApiUrl }`). O `provideHttpClient(withInterceptors([...]))` é sempre adicionado (o `ApiClient` precisa do `HttpClient` e o cache interceptor está sempre registado) e uma lista `withInterceptors([...])` existente é integrada. Um import antigo de `BASE_API_URL` a partir de `cache.service` é movido para `tokens/api.tokens`.

### 4. Token de autenticação (se geraste `AuthInterceptor`)

O CLI gera **`services/auth-token.store.ts`** — um store baseado em signals. Define o token após o login e limpa-o no logout:

```typescript
const auth = inject(AuthTokenStore);
auth.set(response.accessToken); // após login
auth.clear();                   // no logout
```

O interceptor adiciona `Authorization: Bearer <token>` **apenas a URLs em `AUTH_ALLOWED_URLS`** (predefinição: `BASE_API_URL`), comparando origem + prefixo de path — o token nunca vai para hosts de terceiros nem parecidos (`api.example.com.attacker.io`). Permite mais APIs, ou tira um pedido da regra (login, refresh, endpoints públicos):

```typescript
// app.config.ts
{ provide: AUTH_ALLOWED_URLS, useValue: [environment.baseApiUrl, 'https://files.example.com/api'] },

// um pedido que não deve levar o token
this.api.post('/auth/login', credentials, { context: skipAuth() });
```

O `auth.clear()` também limpa o cache de respostas, para o utilizador seguinte nunca ver dados em cache do anterior. O `authGuard` e o error interceptor redirecionam para `LOGIN_ROUTE` (predefinição `/login`); substitui-o nos `providers`: `{ provide: LOGIN_ROUTE, useValue: '/auth/sign-in' }`. O store é em memória — adiciona persistência aí se precisares que a sessão sobreviva a um reload.

## Ficheiros gerados — referência

### `services/api-client.ts` — `ApiClient`

Wrapper fino do `HttpClient` que prefixa o `BASE_API_URL` e expõe cache/retry como opções. Usa-o por **composição** nos teus serviços de feature (`inject(ApiClient)`), não por herança.

```typescript
get<T>(endpoint: string, options?: GetOptions): Observable<T>
post<T>(endpoint: string, body: unknown, options?: RequestOptions): Observable<T>
put / patch  — igual ao post
delete<T>(endpoint: string, options?: RequestOptions & { body?: unknown }): Observable<T>
invalidateCache(endpoint: string, params?: QueryParams): void
url(endpoint: string): string   // URL absoluta

interface RequestOptions { params?: HttpParams | Record<string, …>; headers?: …; context?: HttpContext }
interface GetOptions extends RequestOptions {
  cache?: boolean | { ttlMinutes?: number };  // true = 10 minutos
  retry?: number;                             // só erros de rede / 5xx, com 500 ms de intervalo
}
```

Com `useHttpResource: true` (Angular ≥ 19.2) ganha também **`resource<T>(() => endpoint | undefined, { cache?, ...HttpResourceOptions })`**, que devolve `HttpResourceRef<T | undefined>` — chama-o num contexto de injeção; devolve `undefined` para não fazer o pedido.

### `interceptors/cache.interceptor.ts`

Serve pedidos **GET** marcados a partir do `CacheService` e guarda as respostas com sucesso, com chave `urlWithParams` (query strings diferentes ficam em entradas diferentes; valores falsy como `0` também são guardados). Ativa via `ApiClient` (`{ cache: true }`) ou em qualquer chamada `HttpClient`:

```typescript
this.http.get('/api/countries', { context: withCache({ ttlMinutes: 60 }) });
```

### `services/cache.service.ts` + `services/cache.storage.ts`

- `CacheService`: `get<T>(key)`, `set(key, value, minutos)`, `remove(key)`, `clear()` — entradas em JSON simples com prefixo `ngx-base-cli:` (seguro para Unicode), com expiração.
- `CACHE_STORAGE`: o armazenamento, escolhido por `storageEngine` (`browserStorage("local")`, `browserStorage("session")` ou `memoryStorage()`). Podes trocá-lo nos `providers` sem voltar a correr o CLI. Com Web Storage, o cache não faz nada no servidor (seguro em SSR).

### `interfaces/cache.interface.ts`

`CacheObject` (formato da entrada guardada). `CacheOptions` existe apenas para um `base.service.ts` antigo continuar a compilar.

### Migrar do `BaseService` (≤ 0.1.0-beta.2)

O `update` gera o `api-client.ts` e deixa o teu `base.service.ts` antigo no sítio (continua a compilar), com um aviso. Depois, em cada serviço:

```typescript
// antes
export class UserService extends BaseService {}
this.userService.get('/users', { enabled: true, minutesToExpire: 5 }, 2, params);

// depois
export class UserService {
  private readonly api = inject(ApiClient);
  list() { return this.api.get<User[]>('/users', { cache: { ttlMinutes: 5 }, retry: 2, params }); }
}
```

Quando nada importar o `BaseService`, apaga o `base.service.ts`.

## Comando `add` — artefactos de feature

Gera um artefacto de feature dentro do `outputDir` configurado. O tipo é escolhido com `-t, --type` (predefinição **`service`**). Exige `.ngx-base-cli.json`.

| `--type` | Ficheiro(s) gerado(s) (`outputDir = src/app/core`) |
|----------|----------------------------------------------------|
| `service` (predefinido) | `core/services/<kebab>.service.ts` (`inject(ApiClient)`, endpoint `/<kebab>`) |
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

> `service` exige também `api-client.ts` no `outputDir` configurado (corre `init`/`update` primeiro). Com o `outputDir` predefinido, `add user` fica em **`src/app/core/services/user.service.ts`**.

Exemplo de ficheiro de serviço gerado (`outputDir = src/app/core`):

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

### Exemplo de uso num componente

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
⚠️   src/app/core/services/api-client.ts            desatualizado
❌  src/app/core/interceptors/auth.interceptor.ts  ausente
```

Útil para auditar o estado do projeto antes de correr `update`.

## Comando `doctor`

Valida o teu **setup** depois do `init` (enquanto o `list` valida os **ficheiros** gerados). Verifica:

- Ficheiros base presentes (`cache.interface.ts`, `cache.service.ts`, `cache.storage.ts`, `api-client.ts`, `cache.interceptor.ts`, `tokens/api.tokens.ts`)
- `src/environments/environment.ts` e `environment.prod.ts`
- Aliases no `tsconfig.json` (`@core/*`, e `@layout/*` / `@pages/*` / `@shared/*` quando a estrutura base está ativada)
- `src/app/app.config.ts` liga `provideHttpClient(...)`, o provider `BASE_API_URL` e todos os interceptors gerados (falta do `cacheInterceptor` é erro)
- O `AuthTokenStore` existe quando o `AuthInterceptor` ou a estrutura de pastas foi gerada

Termina com **código não-zero** quando alguma verificação é **erro**, podendo servir de gate em CI.

```bash
npx ngx-base-cli doctor
```

Exemplo de saída:

```
XX  cache.service.ts present
      Expected at src/app/core/services/cache.service.ts. Run `ngx-base-cli init`.
OK  api-client.ts present
!!  alias @core/*
      Add it to tsconfig.json compilerOptions.paths.
OK  provideHttpClient()
OK  BASE_API_URL provider
```

## Flag `--yes` (init)

Totalmente não interativo (bom para CI): sem perguntas. Escolhe o preset com `--preset` (predefinição `standard`); ficheiros existentes são mantidos e os aliases do `tsconfig.json` são adicionados automaticamente (`--no-tsconfig` para os saltar e gerar imports relativos):

```bash
npx ngx-base-cli init --preset full --yes
npx ngx-base-cli init -y                 # standard
npx ngx-base-cli init --preset minimal   # confirmação interativa, sem pergunta de preset
```

Presets:

| Preset | Descrição |
|--------|-----------|
| `minimal` | api client + cache (localStorage), só o cache interceptor |
| `standard` | minimal + auth interceptor (allowlist) + error interceptor + barrel |
| `full` | standard + estrutura base de pastas (layout, pages, routes, shared) |

## Flag `--dry-run` (init)

Pré-visualiza o que o `init` geraria sem escrever nenhum ficheiro no disco:

```bash
npx ngx-base-cli init --dry-run
```

## Workspace e convenção de nomes (`init --project`, `--naming`)

O `init` lê o `angular.json` para encontrar a aplicação alvo — `--project <nome>`, senão `defaultProject`, senão o primeiro projeto `application` — e usa o seu **`sourceRoot`** (app dir, environments, `app.config.ts`, `app.routes.ts`, `fileReplacements`) e o **`prefix`** (selectors de componentes/diretivas gerados). Workspaces com vários projetos funcionam diretamente:

```bash
npx ngx-base-cli init --project admin --preset full --yes
# → projects/admin/src/app/core/…, selectors adm-*, fileReplacements só no "admin"
```

O `project` escolhido fica guardado no `.ngx-base-cli.json`, para o `add`, `update`, `list` e `doctor` usarem a mesma app.

**Convenção de nomes.** O `init` deteta como o projeto nomeia os ficheiros e guarda-a em `naming`:

1. schematics do `angular.json` com `type: "component"` / `type: "service"` (o que o `ng update` para v20 adiciona) → `suffixed`
2. ficheiros `*.component.ts` existentes → `suffixed`; um `app.ts` sem sufixo → `modern`
3. caso contrário, Angular ≥ 20 → `modern`, mais antigo → `suffixed`

Substitui com `--naming modern|suffixed` (ou escolhe no wizard).

| Artefacto | `modern` (style guide Angular v20+) | `suffixed` |
|-----------|-------------------------------------|------------|
| component | `user-card/user-card.ts` · `UserCard` | `user-card/user-card.component.ts` · `UserCardComponent` |
| service | `user.ts` · `UserService` | `user.service.ts` · `UserService` |
| directive | `highlight.ts` · `Highlight` | `highlight.directive.ts` · `HighlightDirective` |
| pipe / guard / resolver / store | `truncate-pipe.ts`, `auth-guard.ts`, `user-resolver.ts`, `cart-store.ts` | `truncate.pipe.ts`, `auth.guard.ts`, `user.resolver.ts`, `cart.store.ts` |
| interface | `user.model.ts` · `User` | `user.interface.ts` · `User` |
| ficheiros do core | `cache.ts`, `cache-storage.ts`, `api-tokens.ts`, `cache-interceptor.ts`, `cache.model.ts` | `cache.service.ts`, `cache.storage.ts`, `api.tokens.ts`, `cache.interceptor.ts`, `cache.interface.ts` |
| layouts / landing | `private-layout.ts` · `PrivateLayout`, `landing-page.ts` · `LandingPage` | `private.component.ts` · `PrivateComponent`, `landing-page.component.ts` · `LandingPageComponent` |

`api-client.ts`, `*.routes.ts` e `*.enum.ts` são iguais nos dois. Configs criadas antes desta opção não têm a chave `naming` e mantêm `suffixed`, por isso o `update` nunca renomeia os teus ficheiros.

## Opção `--cwd`

Executa o comando como se a raiz do projeto fosse outra pasta (útil em monorepos):

```bash
npx ngx-base-cli init --cwd ./apps/web
npx ngx-base-cli add users --cwd ./apps/web
npx ngx-base-cli update --cwd ./apps/web
```

## `.ngx-base-cli.json`

Ficheiro na **raiz do projeto Angular** (mesmo nível que `package.json`). Valores em falta são preenchidos com os predefinidos do CLI ao ler a config; valores inválidos voltam ao predefinido com um aviso.

O `init` escreve uma entrada `"$schema": "https://unpkg.com/ngx-base-cli/schema.json"`, para o VS Code e outros editores darem autocomplete e validação do ficheiro. O schema também vai no pacote (`node_modules/ngx-base-cli/schema.json`).

| Propriedade | Tipo | Predefinição | Descrição |
|-------------|------|--------------|-----------|
| `outputDir` | `string` | `src/app/core` | Pasta base dos ficheiros gerados |
| `baseApiUrl` | `string` | `https://api.example.com` | URL usada no exemplo de `BASE_API_URL` |
| `importStyle` | `"alias"` \| `"relative"` | `"alias"` | Estilo de import do modelo de cache |
| `useHttpResource` | `boolean` | `false` | `GET` com `httpResource` (Angular ≥ 19.2) |
| `storageEngine` | `string` | `"localStorage"` | `"localStorage"`, `"sessionStorage"` ou `"memory"` |
| `generateAuthInterceptor` | `boolean` | `false` | Gera `interceptors/auth.interceptor.ts` |
| `authTokenName` / `authTokenImportPath` | `string` | — | **Obsoleto** — ignorado; o interceptor lê o `AuthTokenStore` |
| `generateErrorInterceptor` | `boolean` | `false` | Gera `interceptors/error.interceptor.ts` |
| `generateLoggingInterceptor` | `boolean` | `false` | Gera `interceptors/logging.interceptor.ts` |
| `generateBarrel` | `boolean` | `true` | Gera `services/index.ts` |
| `generateProjectStructure` | `boolean` | `false` | Gera `layout/`, `pages/landing-page/`, `routes/`, `shared/` em `src/app` e subpastas vazias em `core/` (`directives`, `enum`, `guards`, `interceptors`, `pipes`, `utils`); cria `app.routes.ts` / `app.html` só se não existirem (caso contrário integra as rotas) |
| `naming` | `"modern"` \| `"suffixed"` | detetado pelo `init` (`"suffixed"` se ausente) | Convenção de nomes de ficheiros/classes (ver *Workspace e convenção de nomes*) |
| `project` | `string` | resolvido pelo `init` | Projeto do `angular.json` alvo; o `init` guarda o detetado, para uma mudança posterior no `angular.json` não mudar o alvo do CLI. Vazio = deteção automática |

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

Verificações (as mesmas do CI):

```bash
npm run check && npm run typecheck && npm test   # lint, tipos, testes unitários + integração
npm run e2e                                       # ng new → init → ng build (precisa de rede)
npm run e2e -- modern-full                        # um só cenário (também: suffixed-relative-ssr)
npm run schema                                    # regenera schema.json depois de mudar CONFIG_FIELDS
```

## Licença

MIT
