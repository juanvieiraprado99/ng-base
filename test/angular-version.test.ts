import { describe, expect, it } from "vitest";
import {
  parseAngularCoreVersion,
  versionSupportsHttpResource,
} from "../src/lib/angular-version";

describe("parseAngularCoreVersion", () => {
  it("extracts from caret range", () => {
    expect(parseAngularCoreVersion("^19.1.0")).toBe("19.1.0");
  });
  it("fills missing patch with 0", () => {
    expect(parseAngularCoreVersion("~18.2")).toBe("18.2.0");
  });
  it("returns null for undefined or junk", () => {
    expect(parseAngularCoreVersion(undefined)).toBeNull();
    expect(parseAngularCoreVersion("latest")).toBeNull();
  });
});

describe("versionSupportsHttpResource", () => {
  it("true for 19.1+ and newer majors", () => {
    expect(versionSupportsHttpResource("19.1.0")).toBe(true);
    expect(versionSupportsHttpResource("20.0.0")).toBe(true);
  });
  it("false below 19.1 or null", () => {
    expect(versionSupportsHttpResource("19.0.5")).toBe(false);
    expect(versionSupportsHttpResource("18.2.0")).toBe(false);
    expect(versionSupportsHttpResource(null)).toBe(false);
  });
});
