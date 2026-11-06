import path from "node:path";
import fse from "fs-extra";
import {
  type ArrayLiteralExpression,
  type SourceFile,
  SyntaxKind,
} from "ts-morph";
import { createPatchSourceFile } from "./ts-project.js";
import { DEFAULT_WORKSPACE, type Workspace } from "./workspace.js";

export interface PatchAppRoutesResult {
  /** src/app/app.routes.ts exists. */
  exists: boolean;
  patched: boolean;
  /** False when no `routes` array literal could be located. */
  ok: boolean;
}

const WILDCARD = "{ path: '**', redirectTo: '' }";

function findRoutesArray(sf: SourceFile): ArrayLiteralExpression | undefined {
  const decls = sf.getVariableDeclarations();
  const decl =
    decls.find((d) => d.getName() === "routes") ??
    decls.find((d) => d.getTypeNode()?.getText() === "Routes");
  return decl?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);
}

function ensureNamedImport(
  sf: SourceFile,
  moduleSpecifier: string,
  name: string,
): void {
  const decl = sf.getImportDeclaration(
    (d) => d.getModuleSpecifierValue() === moduleSpecifier,
  );
  if (!decl) {
    sf.addImportDeclaration({ moduleSpecifier, namedImports: [name] });
  } else if (!decl.getNamedImports().some((n) => n.getName() === name)) {
    decl.addNamedImport(name);
  }
}

/**
 * Merge PUBLIC_ROUTES / PRIVATE_ROUTES and a wildcard redirect into an existing
 * `src/app/app.routes.ts` (AST-based, keeps the user's own routes and formatting).
 * Spreads are inserted before an existing `**` route so the wildcard stays last.
 */
export async function patchAppRoutes(
  cwd: string,
  ws: Workspace = DEFAULT_WORKSPACE,
): Promise<PatchAppRoutesResult> {
  const file = path.join(cwd, ws.appDir, "app.routes.ts");
  if (!(await fse.pathExists(file))) {
    return { exists: false, patched: false, ok: true };
  }

  const content = await fse.readFile(file, "utf8");
  const sf = createPatchSourceFile("app.routes.ts", content);
  const arr = findRoutesArray(sf);
  if (!arr) return { exists: true, patched: false, ok: false };

  const wildcardIndex = () =>
    arr
      .getElements()
      .findIndex((e) => /path\s*:\s*['"]\*\*['"]/.test(e.getText()));
  const hasElement = (text: string) =>
    arr.getElements().some((e) => e.getText().replace(/\s/g, "") === text);

  for (const [name, spec] of [
    ["PUBLIC_ROUTES", "./routes/public.routes"],
    ["PRIVATE_ROUTES", "./routes/private.routes"],
  ] as const) {
    ensureNamedImport(sf, spec, name);
    if (!hasElement(`...${name}`)) {
      const wi = wildcardIndex();
      if (wi === -1) arr.addElement(`...${name}`, { useNewLines: true });
      else arr.insertElement(wi, `...${name}`, { useNewLines: true });
    }
  }

  if (wildcardIndex() === -1) arr.addElement(WILDCARD, { useNewLines: true });

  const after = sf.getFullText();
  if (after === content) return { exists: true, patched: false, ok: true };
  await fse.writeFile(file, after, "utf8");
  return { exists: true, patched: true, ok: true };
}
