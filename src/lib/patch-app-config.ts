import fse from "fs-extra";
import path from "node:path";
import type { NgxBaseCliConfig } from "./config.js";
import { importBetweenFiles } from "./import-paths.js";

export interface PatchAppConfigResult {
  patched: boolean;
  appConfigExists: boolean;
  withInterceptorsAlreadyPresent?: boolean;
}

function appendImportsAfterExisting(
  content: string,
  newImportLines: string[]
): string {
  if (newImportLines.length === 0) return content;

  const toAdd = newImportLines.filter((l) => !content.includes(l.trim()));
  if (toAdd.length === 0) return content;

  const importRe = /^import\s[\s\S]*?;\s*$/gm;
  let lastEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(content)) !== null) {
    lastEnd = m.index + m[0].length;
  }
  const insertAt = lastEnd >= 0 ? lastEnd : 0;
  const prefix = content.slice(0, insertAt);
  const suffix = content.slice(insertAt);
  const block = (insertAt > 0 && !prefix.endsWith("\n") ? "\n" : "") +
    toAdd.join("\n") +
    "\n";
  return prefix + block + (suffix.startsWith("\n") || suffix.length === 0 ? "" : "\n") + suffix;
}

function needsInterceptors(config: NgxBaseCliConfig): boolean {
  return (
    config.generateAuthInterceptor ||
    config.generateErrorInterceptor ||
    config.generateLoggingInterceptor
  );
}

function interceptorBindingNames(config: NgxBaseCliConfig): string[] {
  const names: string[] = [];
  if (config.generateAuthInterceptor) names.push("authInterceptor");
  if (config.generateErrorInterceptor) names.push("errorInterceptor");
  if (config.generateLoggingInterceptor) names.push("loggingInterceptor");
  return names;
}

function patchProvideHttpClient(
  content: string,
  interceptorNames: string[]
): string {
  const ix = interceptorNames.join(", ");

  // 1) Simple case: `provideHttpClient()` -> `provideHttpClient(withInterceptors([...]))`
  let next = content.replace(
    /provideHttpClient\s*\(\s*\)/gs,
    `provideHttpClient(withInterceptors([${ix}]))`
  );

  // 2) Non-empty case: `provideHttpClient(...)` and no `withInterceptors(...)` yet.
  // Append `withInterceptors([...])` as an additional argument, preserving existing args.
  if (!/withInterceptors\s*\(/.test(next)) {
    next = next.replace(
      /provideHttpClient\s*\(\s*([\s\S]*?)\s*\)/g,
      (m, args: string) => {
        const a = String(args ?? "").trim();
        if (!a) return m;
        if (/withInterceptors\s*\(/.test(a)) return m;
        return `provideHttpClient(${a}, withInterceptors([${ix}]))`;
      }
    );
  }

  return next;
}

function ensureProvideHttpClientWithInterceptors(
  content: string,
  interceptorNames: string[]
): string {
  if (interceptorNames.length === 0) return content;
  const ix = interceptorNames.join(", ");

  // If user already has withInterceptors(...) we do not try to merge contents.
  if (/withInterceptors\s*\(/.test(content)) {
    return content;
  }

  let next = patchProvideHttpClient(content, interceptorNames);

  const providersBlockMatch = next.match(/providers\s*:\s*\[[\s\S]*?\]/m);
  const hasProvideInProviders =
    providersBlockMatch?.[0] !== undefined &&
    /provideHttpClient\s*\(/.test(providersBlockMatch[0]);

  if (!hasProvideInProviders) {
    next = next.replace(
      /(providers:\s*\[\s*\n)/,
      `$1    provideHttpClient(withInterceptors([${ix}])),\n`
    );
    const providersBlockMatchAfter = next.match(/providers\s*:\s*\[[\s\S]*?\]/m);
    const hasProvideInProvidersAfter =
      providersBlockMatchAfter?.[0] !== undefined &&
      /provideHttpClient\s*\(/.test(providersBlockMatchAfter[0]);
    if (!hasProvideInProvidersAfter) {
      next = next.replace(
        /(providers:\s*\[\s*)/,
        `$1provideHttpClient(withInterceptors([${ix}])), `
      );
    }
  }

  return next;
}

function patchBaseApiProvider(content: string): string {
  if (/\bBASE_API_URL\b/.test(content) && /environment\.baseApiUrl/.test(content)) {
    return content.replace(
      /\{\s*provide:\s*BASE_API_URL\s*,\s*useValue:\s*[^}]+\}/,
      "{ provide: BASE_API_URL, useValue: environment.baseApiUrl }"
    );
  }

  let next = content.replace(
    /\{\s*provide:\s*BASE_API_URL\s*,\s*useValue:\s*['"][^'"]*['"]\s*\}/,
    "{ provide: BASE_API_URL, useValue: environment.baseApiUrl }"
  );

  if (!/\bBASE_API_URL\b/.test(next)) {
    next = next.replace(
      /(providers:\s*\[\s*\n)/,
      `$1    { provide: BASE_API_URL, useValue: environment.baseApiUrl },\n`
    );
    if (!/\bBASE_API_URL\b/.test(next)) {
      next = next.replace(
        /(providers:\s*\[\s*)/,
        `$1{ provide: BASE_API_URL, useValue: environment.baseApiUrl }, `
      );
    }
  }

  return next;
}

function mergeHttpClientImportLine(existing: string): string {
  if (existing.includes("provideHttpClient") && existing.includes("withInterceptors")) {
    return existing;
  }

  let inner = existing
    .replace(/^import\s*\{\s*/, "")
    .replace(/\s*\}\s*from\s*['"]@angular\/common\/http['"];?\s*$/, "");

  const names = inner
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const uniq: string[] = [];
  for (const n of names) {
    if (n && !uniq.includes(n)) uniq.push(n);
  }
  for (const need of ["provideHttpClient", "withInterceptors"]) {
    if (!uniq.includes(need)) uniq.push(need);
  }

  return `import { ${uniq.join(", ")} } from '@angular/common/http';`;
}

function patchAngularHttpImport(content: string, needInterceptors: boolean): string {
  const httpImportRe =
    /import\s*\{[\s\S]*?\}\s*from\s*['"]@angular\/common\/http['"]\s*;?/m;
  const match = content.match(httpImportRe);

  if (match) {
    const merged =
      needInterceptors || match[0].includes("provideHttpClient")
        ? mergeHttpClientImportLine(match[0].replace(/\s+/g, " ").trim())
        : match[0];
    return content.replace(httpImportRe, merged);
  }

  if (!needInterceptors && !/\bprovideHttpClient\b/.test(content)) {
    return content;
  }

  const line =
    needInterceptors || /\bprovideHttpClient\b/.test(content)
      ? `import { provideHttpClient, withInterceptors } from '@angular/common/http';`
      : "";
  if (!line) return content;
  return appendImportsAfterExisting(content, [line]);
}

/**
 * Patch `src/app/app.config.ts` to use `environment.baseApiUrl` and optional interceptor list.
 * Skips overwriting `provideHttpClient` when `withInterceptors` is already present.
 */
export async function patchAppConfigForHttp(
  cwd: string,
  config: NgxBaseCliConfig
): Promise<PatchAppConfigResult> {
  const appConfigPath = path.join(cwd, "src/app/app.config.ts");
  if (!(await fse.pathExists(appConfigPath))) {
    return { patched: false, appConfigExists: false };
  }

  let content = await fse.readFile(appConfigPath, "utf8");

  const cacheSvc = path.join(cwd, config.outputDir, "services/cache.service.ts");
  const cacheImport = importBetweenFiles(appConfigPath, cacheSvc);

  const importLines: string[] = [];

  const envImport =
    "import { environment } from '../environments/environment';";
  if (!/from\s+['"]\.{1,2}\/environments\/environment['"]/.test(content)) {
    importLines.push(envImport);
  }

  const baseApiImport = `import { BASE_API_URL } from '${cacheImport}';`;
  if (
    !/import\s*\{[^}]*\bBASE_API_URL\b[^}]*}\s*from\s*['"][^'"]+['"]/.test(
      content
    )
  ) {
    importLines.push(baseApiImport);
  }

  const ixNeeded = needsInterceptors(config);
  const ixNames = interceptorBindingNames(config);
  const withInterceptorsAlreadyPresent =
    ixNeeded && /withInterceptors\s*\(/.test(content);

  if (config.generateAuthInterceptor) {
    const p = path.join(
      cwd,
      config.outputDir,
      "interceptors/auth.interceptor.ts"
    );
    importLines.push(
      `import { authInterceptor } from '${importBetweenFiles(appConfigPath, p)}';`
    );
  }
  if (config.generateErrorInterceptor) {
    const p = path.join(
      cwd,
      config.outputDir,
      "interceptors/error.interceptor.ts"
    );
    importLines.push(
      `import { errorInterceptor } from '${importBetweenFiles(appConfigPath, p)}';`
    );
  }
  if (config.generateLoggingInterceptor) {
    const p = path.join(
      cwd,
      config.outputDir,
      "interceptors/logging.interceptor.ts"
    );
    importLines.push(
      `import { loggingInterceptor } from '${importBetweenFiles(appConfigPath, p)}';`
    );
  }

  const before = content;
  content = appendImportsAfterExisting(content, importLines);
  content = patchAngularHttpImport(content, ixNeeded);
  content = patchBaseApiProvider(content);
  if (ixNeeded) {
    content = ensureProvideHttpClientWithInterceptors(content, ixNames);
  }

  if (content === before) {
    return {
      patched: false,
      appConfigExists: true,
      withInterceptorsAlreadyPresent: withInterceptorsAlreadyPresent || undefined,
    };
  }

  await fse.writeFile(appConfigPath, content, "utf8");
  return {
    patched: true,
    appConfigExists: true,
    withInterceptorsAlreadyPresent: withInterceptorsAlreadyPresent || undefined,
  };
}
