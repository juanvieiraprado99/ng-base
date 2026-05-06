import { existsSync } from "node:fs";
import fse from "fs-extra";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  vars: Record<string, string>
): Promise<string> {
  const tplPath = path.join(getTemplatesDir(), filename);
  let content = await fse.readFile(tplPath, "utf8");
  for (const [key, value] of Object.entries(vars)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  return content;
}
