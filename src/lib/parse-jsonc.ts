import {
  applyEdits,
  type JSONPath,
  modify,
  type ParseError,
  parse,
  printParseErrorCode,
} from "jsonc-parser";

/**
 * Parse JSON that may contain comments and trailing commas (tsconfig.json,
 * some angular.json files). Throws on syntax errors like `JSON.parse`.
 */
export function parseJsonWithComments(raw: string): unknown {
  const errors: ParseError[] = [];
  const value = parse(raw, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  const first = errors[0];
  if (first) {
    throw new SyntaxError(
      `Invalid JSON: ${printParseErrorCode(first.error)} at offset ${first.offset}`,
    );
  }
  return value;
}

/** Detect the indentation unit of a JSON document (defaults to 2 spaces). */
function detectIndent(raw: string): { insertSpaces: boolean; tabSize: number } {
  const m = raw.match(/^([ \t]+)"/m);
  if (m?.[1]?.startsWith("\t")) return { insertSpaces: false, tabSize: 1 };
  return { insertSpaces: true, tabSize: m?.[1]?.length ?? 2 };
}

/**
 * Set `value` at `jsonPath` (creating missing parents) and return the new text.
 * Only the touched region is rewritten — comments, key order and formatting
 * elsewhere are preserved.
 */
export function setJsonValue(
  raw: string,
  jsonPath: JSONPath,
  value: unknown,
): string {
  const { insertSpaces, tabSize } = detectIndent(raw);
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const edits = modify(raw, jsonPath, value, {
    formattingOptions: { insertSpaces, tabSize, eol },
  });
  return applyEdits(raw, edits);
}
