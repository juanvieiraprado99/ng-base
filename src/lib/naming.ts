export function kebabName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function pascalName(raw: string): string {
  const s = raw.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  const parts = s.split(/[-_/]/).filter(Boolean);
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

export function camelName(raw: string): string {
  const p = pascalName(raw);
  return p.charAt(0).toLowerCase() + p.slice(1);
}
