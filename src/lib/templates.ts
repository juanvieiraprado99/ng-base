import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fse from "fs-extra";

/**
 * `dist/templates` quando o bundle é `dist/index.js`; `src/templates` em dev com `tsx`.
 */
export function getTemplatesDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const colocated = path.join(here, "templates");
  const srcSibling = path.resolve(here, "..", "templates");
  if (existsSync(colocated)) {
    return colocated;
  }
  if (existsSync(srcSibling)) {
    return srcSibling;
  }
  return colocated;
}

export async function applyTemplate(
  filename: string,
  vars: Record<string, string>,
): Promise<string> {
  const tplPath = path.join(getTemplatesDir(), filename);
  let content = await fse.readFile(tplPath, "utf8");
  for (const [key, value] of Object.entries(vars)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  const leftover = [...content.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map(
    (m) => m[1],
  );
  if (leftover.length > 0) {
    const unique = [...new Set(leftover)].join(", ");
    throw new Error(
      `Template "${filename}" has unreplaced token(s): ${unique}. ` +
        `Provide them in vars or fix the template.`,
    );
  }
  return content;
}
