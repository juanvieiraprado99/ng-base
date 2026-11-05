import { IndentationText, Project, QuoteKind, type SourceFile } from "ts-morph";

/** Indentation unit used by `content` (Angular CLI default: 2 spaces). */
export function detectIndentation(content: string): IndentationText {
  const counts = new Map<string, number>();
  for (const m of content.matchAll(/^([ \t]+)\S/gm)) {
    const ws = m[1] ?? "";
    if (ws.startsWith("\t")) return IndentationText.Tab;
    counts.set(ws, (counts.get(ws) ?? 0) + 1);
  }
  const widths = [...counts.keys()].map((w) => w.length);
  const smallest = widths.length ? Math.min(...widths) : 2;
  if (smallest >= 4) return IndentationText.FourSpaces;
  return IndentationText.TwoSpaces;
}

/**
 * In-memory ts-morph source file for AST patches of a project file, matching
 * the file's own indentation so inserted code lines up with what is there.
 */
export function createPatchSourceFile(
  fileName: string,
  content: string,
): SourceFile {
  const project = new Project({
    useInMemoryFileSystem: true,
    manipulationSettings: {
      quoteKind: QuoteKind.Single,
      indentationText: detectIndentation(content),
    },
  });
  return project.createSourceFile(fileName, content);
}
