import path from "node:path";

export function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/** Import TypeScript a partir do app dir (ex.: `src/app/`, onde vive o app.config) até um ficheiro. */
export function importFromSrcApp(
  cwd: string,
  absoluteTargetFile: string,
  appDir = "src/app",
): string {
  const fromDir = path.join(cwd, appDir);
  let rel = path.relative(fromDir, absoluteTargetFile);
  rel = toPosix(rel);
  if (!rel.startsWith(".")) {
    rel = `./${rel}`;
  }
  return rel.replace(/\.ts$/, "");
}

/** Import relativo entre dois ficheiros. */
export function importBetweenFiles(fromFile: string, toFile: string): string {
  let rel = path.relative(path.dirname(fromFile), toFile);
  rel = toPosix(rel);
  if (!rel.startsWith(".")) {
    rel = `./${rel}`;
  }
  return rel.replace(/\.ts$/, "");
}
