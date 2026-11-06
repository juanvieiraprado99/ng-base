/**
 * Language-neutral facts about ngx-base-cli: file names, commands and code.
 * Mirrors what the CLI writes with the `modern` naming style (Angular 20+).
 */

export const MODULE_IDS = [
  'core',
  'auth',
  'errors',
  'logging',
  'layout',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export function isModuleId(value: unknown): value is ModuleId {
  return MODULE_IDS.includes(value as ModuleId);
}

/** created: written by the CLI. patched: an existing file edited in place. yours: already in the app. */
export type FileState = 'created' | 'patched' | 'yours';

export interface FileEntry {
  path: string;
  state: FileState;
}

export interface ModuleData {
  /** Command that installs it. */
  command: string;
  files: FileEntry[];
  codeFile: string;
  code: string;
}

export const MODULES: Record<ModuleId, ModuleData> = {
  core: {
    command: 'npx ngx-base-cli init',
    files: [
      { path: 'src/app/core/services/api-client.ts', state: 'created' },
      { path: 'src/app/core/services/cache.ts', state: 'created' },
      { path: 'src/app/core/services/cache-storage.ts', state: 'created' },
      { path: 'src/app/core/interfaces/cache.model.ts', state: 'created' },
      { path: 'src/app/core/tokens/api-tokens.ts', state: 'created' },
      {
        path: 'src/app/core/interceptors/cache-interceptor.ts',
        state: 'created',
      },
      { path: 'src/environments/environment.ts', state: 'created' },
      { path: 'src/environments/environment.prod.ts', state: 'created' },
      { path: '.ngx-base-cli.json', state: 'created' },
      { path: 'src/app/app.config.ts', state: 'patched' },
      { path: 'angular.json', state: 'patched' },
      { path: 'tsconfig.json', state: 'patched' },
    ],
    codeFile: 'user.ts',
    code: `@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiClient);

  list() {
    return this.api.get<User[]>('/users', {
      cache: { ttlMinutes: 5 },
      retry: 2,
    });
  }
}`,
  },
  auth: {
    command: 'npx ngx-base-cli add auth',
    files: [
      { path: 'src/app/core/tokens/auth-tokens.ts', state: 'created' },
      { path: 'src/app/core/services/auth-token-store.ts', state: 'created' },
      {
        path: 'src/app/core/interceptors/auth-interceptor.ts',
        state: 'created',
      },
      { path: 'src/app/core/guards/auth-guard.ts', state: 'created' },
      { path: 'src/app/app.config.ts', state: 'patched' },
    ],
    codeFile: 'app.config.ts',
    code: `providers: [
  { provide: AUTH_ALLOWED_URLS, useValue: [environment.baseApiUrl] },
  { provide: LOGIN_ROUTE, useValue: '/auth/sign-in' },
]

// after a successful login
inject(AuthTokenStore).set(response.accessToken);

// a request that must not carry the token
this.api.post('/auth/login', credentials, { context: skipAuth() });`,
  },
  errors: {
    command: 'npx ngx-base-cli add errors',
    files: [
      {
        path: 'src/app/core/interceptors/error-interceptor.ts',
        state: 'created',
      },
      { path: 'src/app/app.config.ts', state: 'patched' },
    ],
    codeFile: 'app.ts',
    code: `export class App {
  private readonly toast = inject(Toast);

  constructor() {
    inject(HttpErrorBus)
      .serverErrors$.pipe(takeUntilDestroyed())
      .subscribe(() => this.toast.error('Something went wrong on our side.'));
  }
}`,
  },
  logging: {
    command: 'npx ngx-base-cli add logging',
    files: [
      {
        path: 'src/app/core/interceptors/logging-interceptor.ts',
        state: 'created',
      },
      { path: 'src/app/app.config.ts', state: 'patched' },
    ],
    codeFile: 'app.config.ts',
    code: `provideHttpClient(
  withInterceptors([
    authInterceptor,
    errorInterceptor,
    loggingInterceptor,
    cacheInterceptor,
  ]),
)`,
  },
  layout: {
    command: 'npx ngx-base-cli add layout',
    files: [
      { path: 'src/app/layout/public/public-layout.ts', state: 'created' },
      { path: 'src/app/layout/public/public-layout.html', state: 'created' },
      { path: 'src/app/layout/private/private-layout.ts', state: 'created' },
      { path: 'src/app/layout/private/private-layout.html', state: 'created' },
      { path: 'src/app/pages/landing-page/landing-page.ts', state: 'created' },
      {
        path: 'src/app/pages/landing-page/landing-page.html',
        state: 'created',
      },
      { path: 'src/app/routes/public.routes.ts', state: 'created' },
      { path: 'src/app/routes/private.routes.ts', state: 'created' },
      { path: 'src/app/app.routes.ts', state: 'patched' },
      { path: 'tsconfig.json', state: 'patched' },
      { path: 'src/app/app.html', state: 'yours' },
    ],
    codeFile: 'routes/public.routes.ts',
    code: `export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('@layout/public/public-layout').then((c) => c.PublicLayout),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('@pages/landing-page/landing-page').then(
            (c) => c.LandingPage,
          ),
      },
    ],
  },
];`,
  },
};

export const GITHUB_URL = 'https://github.com/juanvieiraprado99/ng-base';
export const NPM_URL = 'https://www.npmjs.com/package/ngx-base-cli';

/** Lines shown by the terminal on the home page. */
export const TERMINAL_COMMAND = 'npx ngx-base-cli init --yes --with errors';

export const TERMINAL_LINES: { verb: 'create' | 'patch'; path: string }[] = [
  { verb: 'create', path: 'src/app/core/services/api-client.ts' },
  { verb: 'create', path: 'src/app/core/services/cache.ts' },
  { verb: 'create', path: 'src/app/core/interceptors/cache-interceptor.ts' },
  { verb: 'create', path: 'src/app/core/interceptors/error-interceptor.ts' },
  { verb: 'create', path: 'src/environments/environment.ts' },
  { verb: 'patch', path: 'src/app/app.config.ts' },
  { verb: 'patch', path: 'angular.json' },
];

/** Flags of `init`, in the order of the README. */
export const INIT_FLAGS: string[] = [
  '--api-url <url>',
  '--storage local|session|memory',
  '-w, --with <modules> / --all',
  '--naming auto|modern|suffixed',
  '--no-tsconfig',
  '--project <name>',
  '-y, --yes',
  '--overwrite',
  '--dry-run',
];

/** One example command per entry of `commands.items`, in the same order. */
export const COMMAND_LINES: string[] = [
  'npx ngx-base-cli init',
  'npx ngx-base-cli add auth errors',
  'npx ngx-base-cli generate service user --endpoint /users',
  'npx ngx-base-cli list',
  'npx ngx-base-cli doctor',
];
