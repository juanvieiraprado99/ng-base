import {
  applyEdits,
  type FormattingOptions,
  type JSONPath,
  modify,
} from "jsonc-parser";

export interface JsonEdit {
  path: JSONPath;
  value: unknown;
  /** When the last path segment is an array index, insert instead of replace. */
  isArrayInsertion?: boolean;
}

/** Infer indentation and EOL from an existing file so edits blend in. */
export function detectFormatting(raw: string): FormattingOptions {
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const indent = raw.match(/\n([ \t]+)\S/);
  if (indent) {
    const ws = indent[1];
    if (ws.startsWith("\t")) return { tabSize: 1, insertSpaces: false, eol };
    return { tabSize: ws.length, insertSpaces: true, eol };
  }
  return { tabSize: 2, insertSpaces: true, eol };
}

/**
 * Apply surgical edits to JSON/JSONC text. Unlike `JSON.parse` → `JSON.stringify`,
 * this preserves comments, key order, and the file's own formatting — important
 * for `tsconfig.json`, which ships full of explanatory comments from `ng new`.
 */
export function editJsonText(raw: string, edits: JsonEdit[]): string {
  const formattingOptions = detectFormatting(raw);
  let out = raw;
  for (const edit of edits) {
    out = applyEdits(
      out,
      modify(out, edit.path, edit.value, {
        formattingOptions,
        isArrayInsertion: edit.isArrayInsertion,
      }),
    );
  }
  return out;
}
