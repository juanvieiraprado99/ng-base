# ng-base

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/ng-base)](https://nodejs.org/)
[![npm](https://img.shields.io/npm/v/ng-base)](https://www.npmjs.com/package/ng-base)

> 🇬🇧 **English:** [README.md](README.md)

Copia um núcleo HTTP para a tua app Angular — `ApiClient`, cache de respostas, `BASE_API_URL` — e acrescenta **módulos** (auth, errors, logging, layout) um comando de cada vez. Como no [shadcn/ui](https://ui.shadcn.com): o código é **copiado para o teu repositório e passa a ser teu**. O ng-base nunca o sincroniza nem o regenera; edita-o como quiseres.

*Criado pelo Juan para a comunidade Angular <3*

```bash
npx ng-base init          # o núcleo
npx ng-base add auth      # + um módulo
npx ng-base list          # o que existe / o que está instalado
```

## Pré-requisitos

- **Node.js** ≥ 20
- Um projeto **Angular** (corre os comandos na raiz, ao lado do `package.json`)
- O `ApiClient.resource()` (`httpResource`) é incluído automaticamente no Angular **19.2+**

## `init` — o núcleo

```bash
npx ng-base@latest init
```

Pergunta duas coisas — o URL base da API e onde ficam as respostas em cache (`localStorage`, `sessionStorage` ou `memory`) — e depois deixa escolher módulos para adicionar já. O resto é detetado a partir do `angular.json` e do projeto: app alvo, `sourceRoot`, prefixo dos seletores, convenção de nomes, aliases.

Escreve:

```text
src/environments/environment.ts, environment.prod.ts   # baseApiUrl
src/app/core/
├── services/api-client.ts          # ApiClient — injeta-o nos services de feature
├── services/cache.service.ts       # CacheService
├── services/cache.storage.ts       # CACHE_STORAGE (local / session / memory, seguro em SSR)
├── interfaces/cache.interface.ts
├── tokens/api.tokens.ts            # BASE_API_URL
└── interceptors/cache.interceptor.ts
.ng-base.json                       # definições + módulos instalados
```

e liga o projeto (patches por AST/JSONC que mantêm a formatação e os comentários):

- `app.config.ts`: `provideHttpClient(withInterceptors([cacheInterceptor]))` e `{ provide: BASE_API_URL, useValue: environment.baseApiUrl }`
- `angular.json`: `fileReplacements` de produção para o ficheiro de environment
- `tsconfig.json`: o alias `@core/*` (salta com `--no-tsconfig` → imports relativos)

Não interativo (CI, scripts):

```bash
npx ng-base init --yes --api-url https://api.acme.dev --storage memory --with auth,errors
npx ng-base init --yes --all          # núcleo + todos os módulos
```

| Flag | Descrição |
|------|-----------|
| `--api-url <url>` | `BASE_API_URL` escrito nos environments |
| `--storage local\|session\|memory` | storage do cache |
| `-w, --with <módulos>` / `--all` | adicionar módulos já |
| `--naming auto\|modern\|suffixed` | convenção de nomes (predefinição: detetada) |
| `--no-tsconfig` | não mexe no `tsconfig.json`; imports relativos |
| `--project <nome>` | projeto do `angular.json` (workspaces com vários projetos) |
| `-y, --yes` | sem perguntas; ficheiros existentes são mantidos |
| `--overwrite` | substitui ficheiros que já existem |
| `--dry-run` | mostra o que seria escrito |

## `add` — módulos

```bash
npx ng-base add auth errors      # um ou vários
npx ng-base add                  # escolher de uma lista
```

| Módulo | Ficheiros (em `core/` salvo indicação) | Ligação |
|--------|----------------------------------------|---------|
| **auth** | `tokens/auth.tokens.ts` (`AUTH_ALLOWED_URLS`, `skipAuth()`, `LOGIN_ROUTE`), `services/auth-token.store.ts`, `interceptors/auth.interceptor.ts`, `guards/auth.guard.ts` | `authInterceptor` primeiro no `withInterceptors` |
| **errors** | `interceptors/error.interceptor.ts` (`HttpErrorBus`, `FORBIDDEN_ROUTE`) | `errorInterceptor` depois do auth |
| **logging** | `interceptors/logging.interceptor.ts` (só em dev) | `loggingInterceptor` depois do errors |
| **layout** | `layout/{public,private}/`, `pages/landing-page/`, `routes/{public,private}.routes.ts` (em `src/app`) | rotas fundidas no `app.routes.ts`; aliases `@layout/@pages/@shared` |

Os módulos são **independentes**: cada um só importa do núcleo e de si próprio, por isso podem ser adicionados por qualquer ordem. Os interceptors são inseridos na posição canónica (auth → errors → logging → cache por último); interceptors que tenhas adicionado ficam onde estão. Se o `app.config.ts` foi reestruturado e não dá para aplicar o patch, o `add` mostra o snippet para colar.

Ficheiros que já existem **nunca são substituídos** sem `--overwrite` (ou um sim na pergunta); adicionar de novo um módulo instalado não faz nada. O `--dry-run` mostra o plano.

**auth depois do layout:** a rota privada foi gerada sem guard (com um `// TODO`); o `add auth` não reescreve as tuas rotas, só lembra de acrescentar `canMatch: [authGuard]`. Pela ordem inversa, o guard já vem incluído.

## `generate service`

```bash
npx ng-base generate service user --endpoint /users     # alias: ng-base g service user
```

Escreve `core/services/user.ts` (ou `user.service.ts`) — um `UserService` que usa `inject(ApiClient)`. Para componentes, pipes, diretivas, etc. usa o `ng generate`.

## `list` e `doctor`

- `list` (`ls`): todos os módulos, se estão instalados e o comando para os adicionar.
- `doctor`: verifica os ficheiros de cada módulo instalado, os environments, os aliases e os providers/interceptors do `app.config.ts`. Ficheiros movidos ou apagados são avisos — o código é teu.

## Usar o código gerado

### `ApiClient`

Wrapper fino do `HttpClient` que prefixa o `BASE_API_URL` e expõe cache/retry como opções. Usa-o por **composição** nos services de feature:

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
url(endpoint): string     // URLs absolutas mantêm-se; base + endpoint unidos com uma só '/'
```

O `retry` só repete erros de rede e 5xx (com 500 ms de intervalo). `cache: true` = 10 minutos.

### Cache

O `cacheInterceptor` serve a partir do `CacheService` as respostas JSON de **GET** que pediram cache, com chave `urlWithParams`. Ativa pelo `ApiClient` (`{ cache: true }`) ou em qualquer chamada `HttpClient`:

```typescript
this.http.get('/api/countries', { context: withCache({ ttlMinutes: 60 }) });
```

O `CACHE_STORAGE` escolhe o backend (`browserStorage("local" | "session")` ou `memoryStorage()`); troca-o nos `providers`. Com Web Storage o cache não faz nada no servidor (seguro em SSR).

### Auth (`add auth`)

```typescript
const auth = inject(AuthTokenStore);
auth.set(response.accessToken); // depois do login — também limpa o cache quando o token muda
auth.clear();                   // no logout — limpa o token e o cache
```

O interceptor adiciona `Authorization: Bearer <token>` **só aos URLs em `AUTH_ALLOWED_URLS`** (predefinição: `BASE_API_URL`), comparando origem + prefixo do caminho — nunca a APIs de terceiros nem a hosts parecidos. Um **401 num pedido que ele autenticou** limpa o token e redireciona para `LOGIN_ROUTE` (predefinição `/login`) com `returnUrl`; 401 de outras APIs ou de chamadas `skipAuth()` (p. ex. um login falhado) são só relançados.

```typescript
// app.config.ts
{ provide: AUTH_ALLOWED_URLS, useValue: [environment.baseApiUrl, 'https://files.example.com/api'] },
{ provide: LOGIN_ROUTE, useValue: '/auth/sign-in' },

// um pedido que não deve levar o token
this.api.post('/auth/login', credentials, { context: skipAuth() });
```

O store é em memória — acrescenta persistência aí se a sessão tiver de sobreviver a um reload.

### Errors (`add errors`)

403 → `FORBIDDEN_ROUTE` (predefinição `/forbidden`); 5xx → `inject(HttpErrorBus).serverErrors$` (toasts, logging). Os erros são sempre relançados.

## Nomes e workspaces

O `init` usa o projeto do `angular.json` indicado em `--project`, senão o `defaultProject`, senão a primeira aplicação, e guarda-o no `.ng-base.json`. Deteta a convenção de nomes — schematics do `angular.json` com `type: "component"` ou ficheiros `*.component.ts` existentes → `suffixed`; um `app.ts` sem sufixo ou Angular ≥ 20 → `modern`:

| | `modern` (style guide Angular v20+) | `suffixed` |
|-|-------------------------------------|------------|
| núcleo | `cache.ts`, `cache-storage.ts`, `api-tokens.ts`, `cache-interceptor.ts` | `cache.service.ts`, `cache.storage.ts`, `api.tokens.ts`, `cache.interceptor.ts` |
| layout | `private-layout.ts` · `PrivateLayout` | `private.component.ts` · `PrivateComponent` |
| service | `user.ts` · `UserService` | `user.service.ts` · `UserService` |

Usa `--cwd <pasta>` em qualquer comando para o correr noutra pasta (monorepos).

## `.ng-base.json`

As definições de que o `add` e o `generate` precisam para escrever código coerente com o que o `init` escreveu. Tem `$schema` para autocomplete no editor.

| Propriedade | Predefinição | Descrição |
|-------------|--------------|-----------|
| `outputDir` | `src/app/core` | onde fica o núcleo |
| `baseApiUrl` | `https://api.example.com` | escrito nos environments |
| `importStyle` | `alias` | `alias` (`@core/…`) ou `relative` |
| `useHttpResource` | Angular ≥ 19.2 | `ApiClient.resource()` |
| `storageEngine` | `localStorage` | `localStorage`, `sessionStorage`, `memory` |
| `naming` | detetado | `modern` ou `suffixed` |
| `project` | detetado | projeto do `angular.json` |
| `modules` | `[]` | módulos instalados |

## Atualizar a partir do ngx-base-cli 0.1

O pacote mudou de nome: **ngx-base-cli → ng-base**. O primeiro comando `ng-base` num projeto converte o `.ngx-base-cli.json` em `.ng-base.json` (as flags `generate*Interceptor` / `generateProjectStructure` passam a `modules`) e apaga o ficheiro antigo. O `.ngx-base-cli.manifest.json` já não é usado — podes apagá-lo. O `update`, o `remove` e os geradores `add <nome> --type …` saíram: o código é teu depois de instalado, e o `ng generate` cobre componentes, pipes e diretivas. O `init --preset` continua a funcionar (obsoleto) e equivale a `--with`.

## Desenvolvimento local

```bash
npm install
npm run dev -- init --cwd ../minha-app   # correr a partir do código fonte
npm run check && npm run typecheck && npm test
npm run e2e                               # ng new → init → add → ng build (precisa de rede)
npm run e2e -- modern                     # um cenário (também: suffixed-relative-ssr)
npm run schema                            # regenerar o schema.json depois de mudar CONFIG_FIELDS
```

## Licença

MIT
