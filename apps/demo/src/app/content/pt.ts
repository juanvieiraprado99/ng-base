import { Content } from './content.model';

export const PT: Content = {
  ui: {
    skipToContent: 'Ir para o conteúdo',
    menu: 'Menu',
    docsNav: 'Documentação',
    language: 'Idioma',
    switchToLanguage: 'Ler esta página em',
    themeToLight: 'Mudar para o tema claro',
    themeToDark: 'Mudar para o tema escuro',
    copy: 'Copiar',
    copied: 'Copiado',
    github: 'GitHub',
    latestVersion: 'Última versão',
    files: 'Arquivos',
    filesState: {
      created: 'criado',
      patched: 'alterado',
      yours: 'seu',
    },
  },
  nav: {
    start: 'Primeiros passos',
    concepts: 'Como funciona',
    modules: 'Módulos',
    commands: 'Comandos',
    config: 'Configuração',
  },
  home: {
    pageTitle: 'ngx-base-cli: um núcleo HTTP para Angular que é seu',
    title: 'Copie a camada HTTP para o seu app Angular. Depois, ela é sua.',
    lead: 'O ngx-base-cli escreve no seu projeto um cliente de API, um cache de respostas e interceptors, como arquivos de código comuns. Adicione autenticação, tratamento de erros, logs e um layout público/privado quando precisar. Não há pacote em runtime para manter atualizado.',
    ctaStart: 'Primeiros passos',
    ctaGithub: 'Código no GitHub',
    terminalLabel:
      'Saída do terminal do ngx-base-cli init: ele cria os arquivos do núcleo e altera app.config.ts e angular.json.',
    whyTitle: 'O que você ganha',
    why: [
      {
        title: 'Código que você lê',
        body: 'Cada arquivo vai para o seu repositório, com o estilo de nomes do seu projeto. Mude, mova ou apague. O ngx-base-cli nunca mais mexe nele.',
      },
      {
        title: 'Um módulo por vez',
        body: 'O `init` escreve o núcleo. Auth, errors, logging e layout são comandos separados, e cada um importa só do núcleo e de si mesmo, então você adiciona na ordem que quiser.',
      },
      {
        title: 'Se encaixa no projeto que encontra',
        body: 'Ele lê o `angular.json` e os seus arquivos para escolher o app, o prefixo dos seletores, o estilo de nomes e o tipo de import. Depois altera `app.config.ts`, `angular.json` e `tsconfig.json` sem reformatá-los.',
      },
    ],
    filesTitle: 'O que o init escreve',
    filesLead:
      'Em um app Angular novo, o `init` cria estes arquivos e edita três que já existiam.',
    legend:
      'Cada arquivo tem uma marca: criado pelo CLI, alterado no lugar ou já seu.',
    builtWithTitle: 'Este site foi feito com ele',
    builtWith:
      'As pastas `core`, `errors` e `layout` deste site foram geradas por `init --with errors,layout`. Depois disso, o código passou a ser do site, como será do seu.',
    builtWithLink: 'Ver o código-fonte deste site',
  },
  start: {
    pageTitle: 'Primeiros passos',
    title: 'Primeiros passos',
    lead: 'Quatro comandos levam um app Angular de vazio a fazer chamadas de API com cache.',
    prerequisitesTitle: 'Antes de começar',
    prerequisites: [
      'Node.js 20 ou superior.',
      'Um projeto Angular. Rode cada comando na raiz dele, ao lado do `package.json`.',
      'No Angular 19.2 ou superior, o `ApiClient.resource()` (baseado em `httpResource`) é adicionado para você.',
    ],
    steps: [
      {
        title: 'Instale o núcleo',
        body: 'Responda duas perguntas: a URL base da API e onde as respostas em cache ficam (`localStorage`, `sessionStorage` ou `memory`). Depois escolha módulos para adicionar na hora, ou pule.',
        code: 'npx ngx-base-cli@latest init',
      },
      {
        title: 'Adicione um módulo',
        body: 'Rode `add` sem nomes para escolher em uma lista. Arquivos que já existem nunca são substituídos, a menos que você passe `--overwrite`.',
        code: 'npx ngx-base-cli add auth errors',
      },
      {
        title: 'Crie um serviço',
        body: 'Ele escreve um serviço que usa `inject(ApiClient)`. Chame `api.get(url, { cache: true })` para guardar a resposta por 10 minutos.',
        code: 'npx ngx-base-cli generate service user --endpoint /users',
      },
      {
        title: 'Confira a instalação',
        body: 'Ele verifica os arquivos de cada módulo instalado, os environments, os aliases de caminho e os providers do `app.config.ts`. Arquivos que você moveu ou apagou aparecem como avisos, porque o código é seu.',
        code: 'npx ngx-base-cli doctor',
      },
    ],
    ciTitle: 'Rode sem perguntas',
    ciBody:
      'Use `--yes` em CI e scripts. Acrescente `--dry-run` a qualquer comando para ver o que ele escreveria.',
    ciCode:
      'npx ngx-base-cli init --yes --api-url https://api.acme.dev --storage memory --with auth,errors',
  },
  concepts: {
    pageTitle: 'Como funciona',
    title: 'Como funciona',
    lead: 'O ngx-base-cli copia arquivos em vez de instalar uma biblioteca. Estas são as regras que ele segue ao fazer isso.',
    sections: [
      {
        title: 'O código passa a ser seu',
        body: [
          'Como o shadcn/ui, nada liga o seu projeto ao CLI depois que um comando termina. Não há sincronização, comando de atualização nem manifesto.',
          'O único registro é o `.ngx-base-cli.json`. Ele guarda as configurações de que `add` e `generate` precisam para escrever código compatível com o que o `init` escreveu.',
        ],
      },
      {
        title: 'Arquivos existentes ficam seguros',
        body: [
          'O CLI nunca substitui um arquivo existente sem `--overwrite` ou um sim na pergunta. Adicionar um módulo que já está instalado não faz nada.',
          'As edições em `app.config.ts`, `angular.json` e `tsconfig.json` preservam a sua formatação e os seus comentários. Se o `app.config.ts` foi reestruturado e não dá para alterá-lo, o `add` mostra o trecho para você colar.',
        ],
      },
      {
        title: 'Os interceptors rodam em ordem fixa',
        body: [
          'Cada módulo insere o seu interceptor em uma posição canônica: auth, errors, logging e, por último, o cache. Interceptors que você adicionou ficam onde estão.',
        ],
        code: `provideHttpClient(
  withInterceptors([
    authInterceptor,
    errorInterceptor,
    loggingInterceptor,
    cacheInterceptor,
  ]),
)`,
      },
      {
        title: 'Os módulos são independentes',
        body: [
          'Um módulo importa só do núcleo e de si mesmo, então a ordem em que você os adiciona não importa.',
          'A única exceção é o layout, que verifica se o auth existe. Com o auth instalado, a rota privada recebe `canMatch: [authGuard]`. Se você adicionar o auth depois, o CLI lembra de incluir o guard em vez de reescrever as suas rotas.',
        ],
      },
      {
        title: 'Nomes e imports seguem o seu projeto',
        body: [
          'Um arquivo `*.component.ts` ou `type: "component"` nos schematics do `angular.json` escolhe o estilo com sufixos. Um `app.ts` sem sufixo, ou Angular 20 em diante, escolhe o estilo moderno. Force um deles com `--naming`.',
          'Aliases de caminho como `@core/*` entram no `tsconfig.json`. Passe `--no-tsconfig` para usar imports relativos. Em um workspace, escolha o app com `--project` e rode em outra pasta com `--cwd`.',
        ],
        table: {
          head: ['', 'modern (guia de estilo do Angular 20+)', 'suffixed'],
          rows: [
            [
              'core',
              'cache.ts, cache-storage.ts, api-tokens.ts, cache-interceptor.ts',
              'cache.service.ts, cache.storage.ts, api.tokens.ts, cache.interceptor.ts',
            ],
            [
              'layout',
              'private-layout.ts · PrivateLayout',
              'private.component.ts · PrivateComponent',
            ],
            ['service', 'user.ts · UserService', 'user.service.ts · UserService'],
          ],
        },
      },
    ],
  },
  modules: {
    pageTitle: (module) => `Módulo ${module}`,
    addHeading: 'Como adicionar',
    filesHeading: 'Arquivos',
    wiringHeading: 'O que ele configura',
    usageHeading: 'Como se comporta',
    codeHeading: 'Exemplo',
    items: {
      core: {
        title: 'core',
        summary:
          '`ApiClient`, um cache de respostas e o `BASE_API_URL`. Escrito pelo `init`, nunca pelo `add`.',
        wiring:
          '`provideHttpClient(withInterceptors([cacheInterceptor]))` e `BASE_API_URL` no `app.config.ts`, `fileReplacements` de produção no `angular.json` e o alias `@core/*` no `tsconfig.json`.',
        usage: [
          'O `ApiClient` envolve o `HttpClient`: ele coloca o `BASE_API_URL` na frente e transforma cache e retry em opções. Injete-o nos serviços das features em vez de estendê-lo.',
          '`cache: true` guarda uma resposta GET por 10 minutos. O `retry` repete só erros de rede e respostas 5xx, com 500 ms de intervalo.',
          'O `CACHE_STORAGE` escolhe o backend: `localStorage`, `sessionStorage` ou memória. Com Web Storage, o cache não faz nada no servidor, então o SSR é seguro.',
        ],
      },
      auth: {
        title: 'auth',
        summary:
          'Um armazenamento de token baseado em signals, um interceptor Bearer e um guard de rota.',
        wiring: 'O `authInterceptor` entra primeiro no `withInterceptors`.',
        usage: [
          'O interceptor adiciona `Authorization: Bearer` só nas URLs de `AUTH_ALLOWED_URLS` (padrão: `BASE_API_URL`), comparando origem e prefixo do caminho. Hosts de terceiros e parecidos nunca recebem o token.',
          'Um 401 em uma requisição que ele autenticou limpa o token e redireciona para `LOGIN_ROUTE` (padrão `/login`) com um `returnUrl`. Use `skipAuth()` nas chamadas que não podem levar o token, como o próprio login.',
          'O armazenamento fica em memória. Adicione persistência nele se a sessão precisar sobreviver a um reload.',
        ],
      },
      errors: {
        title: 'errors',
        summary:
          'Redireciona respostas 403 e publica erros do servidor para você exibir.',
        wiring: 'O `errorInterceptor` entra depois do auth.',
        usage: [
          'Um 403 navega para `FORBIDDEN_ROUTE` (padrão `/forbidden`).',
          'Uma resposta 5xx é publicada em `HttpErrorBus.serverErrors$`, pronta para toasts ou logs.',
          'Todo erro é relançado, então o seu próprio `catchError` continua funcionando.',
        ],
      },
      logging: {
        title: 'logging',
        summary:
          'Registra o método, a URL e o tempo de cada requisição enquanto você desenvolve.',
        wiring: 'O `loggingInterceptor` entra depois do errors.',
        usage: [
          'Ele só registra quando `isDevMode()` é verdadeiro, então os builds de produção ficam silenciosos.',
        ],
      },
      layout: {
        title: 'layout',
        summary:
          'Layouts público e privado, uma landing page e as rotas que os montam.',
        wiring:
          '`PUBLIC_ROUTES` e `PRIVATE_ROUTES` são mescladas no `app.routes.ts` com um redirecionamento curinga. Os aliases `@layout`, `@pages` e `@shared` entram no `tsconfig.json`.',
        usage: [
          'A área pública fica em `/` e a privada em `/app`. Adicione páginas como filhas de `PUBLIC_ROUTES` ou `PRIVATE_ROUTES`.',
          'Com o auth instalado, a rota privada é criada com `canMatch: [authGuard]`. Sem ele, a rota leva um comentário TODO.',
          'O layout público deste site começou a partir destes arquivos.',
        ],
      },
    },
  },
  commands: {
    pageTitle: 'Comandos',
    title: 'Comandos',
    lead: 'Rode cada um na raiz do seu projeto Angular. Use `--cwd <dir>` para apontar para outra pasta.',
    items: [
      {
        title: 'init',
        body: 'Escreve o núcleo e configura o projeto. Pergunta a URL base da API e o armazenamento do cache, e detecta o resto a partir do seu projeto.',
      },
      {
        title: 'add',
        body: 'Adiciona um ou mais módulos: auth, errors, logging ou layout. Sem nomes, mostra uma lista.',
      },
      {
        title: 'generate service',
        body: 'Cria um serviço que usa o `ApiClient`, por exemplo `UserService`. Alias: `g`. Para componentes, pipes e diretivas, continue usando `ng generate`.',
      },
      {
        title: 'list',
        body: 'Mostra cada módulo, se ele está instalado e o comando para adicioná-lo. Alias: `ls`.',
      },
      {
        title: 'doctor',
        body: 'Confere a instalação e aponta problemas. Arquivos movidos ou apagados são avisos, nunca erros.',
      },
    ],
    flagsTitle: 'Flags do init',
    flagsLead: 'Combine com `--yes` para rodar sem perguntas.',
    flagHead: 'Flag',
    flagDescriptionHead: 'O que faz',
    flags: {
      '--api-url <url>': 'Define o `BASE_API_URL` nos arquivos de environment.',
      '--storage local|session|memory': 'Escolhe onde as respostas em cache ficam.',
      '-w, --with <modules> / --all': 'Adiciona módulos na hora.',
      '--naming auto|modern|suffixed': 'Nomes de arquivo. Padrão: detectado.',
      '--no-tsconfig': 'Não mexe no `tsconfig.json` e usa imports relativos.',
      '--project <name>': 'Escolhe o projeto do `angular.json` em um workspace com vários projetos.',
      '-y, --yes': 'Sem perguntas. Arquivos existentes são mantidos.',
      '--overwrite': 'Substitui arquivos que já existem.',
      '--dry-run': 'Mostra o que seria escrito, e não escreve nada.',
    },
  },
  config: {
    pageTitle: 'Configuração',
    title: '.ngx-base-cli.json',
    lead: 'O `init` escreve este arquivo na raiz do seu projeto. `add` e `generate` o leem para produzir código compatível. Ele tem um `$schema`, então os editores oferecem autocompletar.',
    propertyHead: 'Propriedade',
    typeHead: 'Tipo',
    defaultHead: 'Padrão',
    descriptionHead: 'Descrição',
    fields: {
      outputDir: 'Pasta onde o núcleo é gerado, relativa à raiz do projeto.',
      baseApiUrl: 'Escrita nos arquivos de environment como `BASE_API_URL`.',
      importStyle: '`alias` escreve imports `@core/…`. `relative` escreve imports `../`.',
      useHttpResource:
        'Adiciona o `ApiClient.resource()`. Ligado automaticamente no Angular 19.2 em diante.',
      storageEngine: 'Backend do cache de respostas. Seguro para SSR.',
      naming: 'Nomes de arquivos e classes. Detectado do projeto quando ausente.',
      project: 'O projeto do `angular.json` a usar. Vazio significa detectar sozinho.',
      modules: 'Módulos instalados com o `add`.',
    },
  },
  notFound: {
    title: 'Página não encontrada',
    body: 'Não há nada neste endereço. Escolha um idioma para voltar à documentação.',
    link: 'Ir para a documentação em',
  },
};
