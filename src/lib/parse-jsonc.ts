import stripJsonComments from "strip-json-comments";

/** Parse JSON that may contain `//` and `/* *\/` comments (typical of tsconfig / some angular.json). */
export function parseJsonWithComments(raw: string): unknown {
  return JSON.parse(stripJsonComments(raw));
}
