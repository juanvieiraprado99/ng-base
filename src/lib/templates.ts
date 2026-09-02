import fse from "fs-extra";
import { resolveTemplatePath } from "./template-registry.js";

export async function applyTemplate(
  filename: string,
  vars: Record<string, string>,
  cwd: string,
): Promise<string> {
  const tplPath = await resolveTemplatePath(filename, cwd);
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
