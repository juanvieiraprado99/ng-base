import path from "node:path";
import fse from "fs-extra";
import {
  type ArrayLiteralExpression,
  type CallExpression,
  type ObjectLiteralExpression,
  type SourceFile,
  SyntaxKind,
} from "ts-morph";
import type { NgBaseConfig } from "./config.js";
import { importBetweenFiles } from "./import-paths.js";
import {
  apiTokensFile,
  interceptorBindings,
  interceptorOrder,
} from "./modules.js";
import { createPatchSourceFile } from "./ts-project.js";
import { DEFAULT_WORKSPACE, type Workspace } from "./workspace.js";

export interface PatchAppConfigResult {
  patched: boolean;
  appConfigExists: boolean;
  /** Informational: interceptor list already existed before patching. */
  withInterceptorsAlreadyPresent?: boolean;
  /**
   * Set when the file exists but its `providers` array could not be found
   * (e.g. restructured by hand): the snippet to add manually.
   */
  manual?: string;
}

const HTTP_MODULE = "@angular/common/http";

/**
 * Remove `name` from every import declaration except the one for
 * `keepModule` (e.g. BASE_API_URL used to live in cache.service). Drops the
 * declaration when it ends up empty.
 */
function removeNamedImportElsewhere(
  sf: SourceFile,
  name: string,
  keepModule: string,
): void {
  for (const decl of sf.getImportDeclarations()) {
    if (decl.getModuleSpecifierValue() === keepModule) continue;
    const spec = decl.getNamedImports().find((n) => n.getName() === name);
    if (!spec) continue;
    spec.remove();
    if (
      decl.getNamedImports().length === 0 &&
      !decl.getDefaultImport() &&
      !decl.getNamespaceImport()
    ) {
      decl.remove();
    }
  }
}

/** Add the given named imports to a module's import declaration, creating it if absent. */
function ensureNamedImports(
  sf: SourceFile,
  moduleSpecifier: string,
  names: string[],
): void {
  if (names.length === 0) return;
  const decl = sf.getImportDeclaration(
    (d) => d.getModuleSpecifierValue() === moduleSpecifier,
  );
  if (!decl) {
    sf.addImportDeclaration({ moduleSpecifier, namedImports: names });
    return;
  }
  const existing = new Set(decl.getNamedImports().map((n) => n.getName()));
  const toAdd = names.filter((n) => !existing.has(n));
  if (toAdd.length > 0) decl.addNamedImports(toAdd);
}

function findProvidersArray(
  sf: SourceFile,
): ArrayLiteralExpression | undefined {
  const prop = sf
    .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .find(
      (pa) =>
        pa.getName() === "providers" &&
        pa.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression) !==
          undefined,
    );
  return prop?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);
}

function findCallElement(
  arr: ArrayLiteralExpression,
  fnName: string,
): CallExpression | undefined {
  return arr
    .getElements()
    .find(
      (e): e is CallExpression =>
        e.getKind() === SyntaxKind.CallExpression &&
        (e as CallExpression).getExpression().getText() === fnName,
    ) as CallExpression | undefined;
}

function findCallArgument(
  call: CallExpression,
  fnName: string,
): CallExpression | undefined {
  return call
    .getArguments()
    .find(
      (a): a is CallExpression =>
        a.getKind() === SyntaxKind.CallExpression &&
        (a as CallExpression).getExpression().getText() === fnName,
    ) as CallExpression | undefined;
}

function findBaseApiProvider(
  arr: ArrayLiteralExpression,
): ObjectLiteralExpression | undefined {
  return arr.getElements().find((e): e is ObjectLiteralExpression => {
    const obj = e.asKind(SyntaxKind.ObjectLiteralExpression);
    if (!obj) return false;
    const provide = obj
      .getProperty("provide")
      ?.asKind(SyntaxKind.PropertyAssignment);
    return provide?.getInitializer()?.getText() === "BASE_API_URL";
  }) as ObjectLiteralExpression | undefined;
}

function patchProvideHttpClient(
  arr: ArrayLiteralExpression,
  interceptorNames: string[],
): void {
  const ix = interceptorNames.join(", ");
  const call = findCallElement(arr, "provideHttpClient");

  if (!call) {
    arr.addElement(
      interceptorNames.length > 0
        ? `provideHttpClient(withInterceptors([${ix}]))`
        : "provideHttpClient()",
      { useNewLines: true },
    );
    return;
  }
  if (interceptorNames.length === 0) return;

  const withInterceptors = findCallArgument(call, "withInterceptors");
  if (!withInterceptors) {
    call.addArgument(`withInterceptors([${ix}])`);
    return;
  }

  // Merge missing interceptor identifiers into the existing array, each at its
  // canonical position (before the first known interceptor that comes after
  // it); interceptors the user added stay where they are.
  const list = withInterceptors
    .getArguments()[0]
    ?.asKind(SyntaxKind.ArrayLiteralExpression);
  if (!list) return;
  const order = interceptorOrder();
  for (const name of interceptorNames) {
    const elements = list.getElements().map((e) => e.getText());
    if (elements.includes(name)) continue;
    const rank = order.get(name) ?? Number.POSITIVE_INFINITY;
    const at = elements.findIndex(
      (e) => (order.get(e) ?? Number.NEGATIVE_INFINITY) > rank,
    );
    if (at === -1) list.addElement(name);
    else list.insertElement(at, name);
  }
}

function patchBaseApiProvider(arr: ArrayLiteralExpression): void {
  const obj = findBaseApiProvider(arr);
  if (!obj) {
    arr.addElement(
      "{ provide: BASE_API_URL, useValue: environment.baseApiUrl }",
      { useNewLines: true },
    );
    return;
  }
  const useValue = obj
    .getProperty("useValue")
    ?.asKind(SyntaxKind.PropertyAssignment);
  if (useValue) {
    if (useValue.getInitializer()?.getText() !== "environment.baseApiUrl") {
      useValue.setInitializer("environment.baseApiUrl");
    }
  } else {
    obj.addPropertyAssignment({
      name: "useValue",
      initializer: "environment.baseApiUrl",
    });
  }
}

/**
 * Patch `<appDir>/app.config.ts` to use `environment.baseApiUrl` and the optional
 * interceptor list. Uses an AST (ts-morph) so formatting/comments survive and an
 * existing `withInterceptors([...])` is merged rather than skipped.
 */
export async function patchAppConfigForHttp(
  cwd: string,
  config: NgBaseConfig,
  ws: Workspace = DEFAULT_WORKSPACE,
): Promise<PatchAppConfigResult> {
  const appConfigPath = path.join(cwd, ws.appDir, "app.config.ts");
  if (!(await fse.pathExists(appConfigPath))) {
    return { patched: false, appConfigExists: false };
  }

  const content = await fse.readFile(appConfigPath, "utf8");

  const sf = createPatchSourceFile("app.config.ts", content);
  const before = sf.getFullText();

  const bindings = interceptorBindings(config);
  const ixNames = bindings.map((b) => b.name);
  const withInterceptorsAlreadyPresent = /withInterceptors\s*\(/.test(content);

  // Imports.
  const envFile = path.join(cwd, ws.sourceRoot, "environments/environment.ts");
  ensureNamedImports(sf, importBetweenFiles(appConfigPath, envFile), [
    "environment",
  ]);

  const apiTokensPath = path.join(cwd, config.outputDir, apiTokensFile(config));
  const apiTokensImport = importBetweenFiles(appConfigPath, apiTokensPath);
  removeNamedImportElsewhere(sf, "BASE_API_URL", apiTokensImport);
  ensureNamedImports(sf, apiTokensImport, ["BASE_API_URL"]);

  for (const { name, file } of bindings) {
    const abs = path.join(cwd, config.outputDir, file);
    ensureNamedImports(sf, importBetweenFiles(appConfigPath, abs), [name]);
  }

  const providers = findProvidersArray(sf);
  if (!providers) {
    return {
      patched: false,
      appConfigExists: true,
      manual: buildProviderSnippet(bindings.map((b) => b.name)),
    };
  }
  // ApiClient injects HttpClient; the cache interceptor is always registered.
  ensureNamedImports(sf, HTTP_MODULE, [
    "provideHttpClient",
    "withInterceptors",
  ]);
  patchProvideHttpClient(providers, ixNames);
  patchBaseApiProvider(providers);

  const after = sf.getFullText();
  if (after === before) {
    return {
      patched: false,
      appConfigExists: true,
      withInterceptorsAlreadyPresent:
        withInterceptorsAlreadyPresent || undefined,
    };
  }

  await fse.writeFile(appConfigPath, after, "utf8");
  return {
    patched: true,
    appConfigExists: true,
    withInterceptorsAlreadyPresent: withInterceptorsAlreadyPresent || undefined,
  };
}

/** The providers to add by hand when app.config.ts cannot be patched. */
export function buildProviderSnippet(interceptorNames: string[]): string {
  return [
    "providers: [",
    `  provideHttpClient(withInterceptors([${interceptorNames.join(", ")}])),`,
    "  { provide: BASE_API_URL, useValue: environment.baseApiUrl },",
    "]",
  ].join("\n");
}
