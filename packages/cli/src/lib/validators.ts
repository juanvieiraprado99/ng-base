import path from "node:path";

export function validateUrl(value: string): string | undefined {
  const v = String(value).trim();
  if (!/^https?:\/\//i.test(v)) {
    return "The URL must start with http:// or https://";
  }
}

export function validateRelativePath(value: string): string | undefined {
  const v = String(value).trim();
  if (!v) return "Enter a path.";
  if (path.isAbsolute(v)) {
    return "Use a path relative to the project root (e.g. src/app/core).";
  }
  const segments = v.split(/[/\\]+/);
  if (segments.includes("..")) {
    return "Path must stay inside the project root (no '..' segments).";
  }
}
