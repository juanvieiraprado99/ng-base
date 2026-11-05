import { describe, expect, it } from "vitest";
import { validateRelativePath, validateUrl } from "../src/lib/validators";

describe("validateUrl", () => {
  it("accepts http/https", () => {
    expect(validateUrl("https://api.example.com")).toBeUndefined();
    expect(validateUrl("http://localhost:3000")).toBeUndefined();
  });
  it("rejects missing scheme", () => {
    expect(validateUrl("api.example.com")).toMatch(/http/);
    expect(validateUrl("ftp://x")).toMatch(/http/);
  });
});

describe("validateRelativePath", () => {
  it("accepts relative paths", () => {
    expect(validateRelativePath("src/app/core")).toBeUndefined();
  });
  it("rejects empty", () => {
    expect(validateRelativePath("   ")).toBe("Enter a path.");
  });
  it("rejects absolute", () => {
    expect(validateRelativePath("/etc/app")).toMatch(/relative/);
  });
  it("rejects parent-dir traversal", () => {
    expect(validateRelativePath("../../etc")).toMatch(/\.\./);
    expect(validateRelativePath("src/../../x")).toMatch(/\.\./);
    expect(validateRelativePath("..\\..\\x")).toMatch(/\.\./);
  });
});
