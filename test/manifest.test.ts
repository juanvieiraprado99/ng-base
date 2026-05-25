import { describe, expect, it } from "vitest";
import { classifyTarget, sha256 } from "../src/lib/manifest";

describe("classifyTarget", () => {
  it("absent when disk content is null", () => {
    expect(classifyTarget(null, "x", undefined)).toBe("absent");
  });

  it("in-sync when disk matches rendered", () => {
    expect(classifyTarget("same", "same", sha256("anything"))).toBe("in-sync");
  });

  it("drift when disk is pristine CLI output but rendered changed", () => {
    const disk = "old generated";
    expect(classifyTarget(disk, "new generated", sha256(disk))).toBe("drift");
  });

  it("edited when disk differs from last CLI-written hash", () => {
    expect(
      classifyTarget("user changed", "new generated", sha256("old generated"))
    ).toBe("edited");
  });

  it("drift when no manifest record exists (legacy/manual file)", () => {
    expect(classifyTarget("whatever", "different", undefined)).toBe("drift");
  });
});
