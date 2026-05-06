import path from "node:path";

export function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/** Import TypeScript a partir de `src/app/` até um ficheiro (ex: app.config). */
export function importFromSrcApp(
  cwd: string,
  absoluteTargetFile: string
): string {
  const fromDir = path.join(cwd, "src", "app");
  let rel = path.relative(fromDir, absoluteTargetFile);
  rel = toPosix(rel);
  if (!rel.startsWith(".")) {
    rel = "./" + rel;
  }
  return rel.replace(/\.ts$/, "");
}

/** Import relativo entre dois ficheiros. */
export function importBetweenFiles(
  fromFile: string,
  toFile: string
): string {
  let rel = path.relative(path.dirname(fromFile), toFile);
  rel = toPosix(rel);
  if (!rel.startsWith(".")) {
    rel = "./" + rel;
  }
  return rel.replace(/\.ts$/, "");
}
