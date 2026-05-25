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

/**
 * Import specifier for a generated `import ... from "<here>"`. Rejects characters
 * that could break out of the string literal in the rendered template.
 */
export function validateImportPath(value: string): string | undefined {
  const v = String(value).trim();
  if (!v) return "Enter an import path.";
  if (!/^[\w@./-]+$/.test(v)) {
    return "Import path may only contain letters, digits, and @ . / - _ characters.";
  }
}

export function validateIdentifier(value: string): string | undefined {
  const s = String(value).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) {
    return "Must be a valid JavaScript identifier.";
  }
}
