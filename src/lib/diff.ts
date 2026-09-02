import { diffLines } from "diff";
import pc from "picocolors";

/** Unified-ish coloured diff, one line per source line. */
export function formatDiff(oldContent: string, newContent: string): string {
  const parts = diffLines(oldContent, newContent);
  let out = "";
  for (const part of parts) {
    const lines = part.value.replace(/\n$/, "").split("\n");
    for (const line of lines) {
      if (part.added) {
        out += `${pc.green(`+ ${line}`)}\n`;
      } else if (part.removed) {
        out += `${pc.red(`- ${line}`)}\n`;
      } else {
        out += `  ${line}\n`;
      }
    }
  }
  return out.trimEnd();
}
