/**
 * Extrai a versão semver principal de um range npm (ex: ^19.1.0 → 19.1.0).
 */
export function parseAngularCoreVersion(
  range: string | undefined,
): string | null {
  if (!range) return null;
  const cleaned = range.replace(/^[\^~>=\s]+/, "").trim();
  const match = cleaned.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;
  const patch = match[3] ?? "0";
  return `${match[1]}.${match[2]}.${patch}`;
}

/** httpResource estável a partir do Angular 19.1 (conforme documentação). */
export function versionSupportsHttpResource(version: string | null): boolean {
  if (!version) return false;
  const parts = version.split(".").map((p) => Number.parseInt(p, 10));
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  return major > 19 || (major === 19 && minor >= 1);
}
