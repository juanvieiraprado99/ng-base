import { describe, expect, it } from "vitest";
import { parseJsonWithComments } from "../src/lib/parse-jsonc";

describe("parseJsonWithComments", () => {
  it("strips line and block comments", () => {
    const raw = `{
      // line comment
      "a": 1,
      /* block */ "b": 2
    }`;
    expect(parseJsonWithComments(raw)).toEqual({ a: 1, b: 2 });
  });

  it("parses plain JSON", () => {
    expect(parseJsonWithComments('{"x":true}')).toEqual({ x: true });
  });
});
