import { describe, expect, it } from "vitest";
import { formatDiff } from "../src/lib/diff";

describe("formatDiff", () => {
  it("marks added and removed lines", () => {
    const out = formatDiff("a\nb\n", "a\nc\n");
    expect(out).toContain("- b");
    expect(out).toContain("+ c");
    expect(out).toContain("  a");
  });

  it("returns an empty string for identical input", () => {
    expect(formatDiff("same\n", "same\n")).toBe("  same");
  });
});
