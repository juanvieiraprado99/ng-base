import { describe, expect, it } from "vitest";
import {
  validateIdentifier,
  validateImportPath,
  validateRelativePath,
  validateUrl,
} from "../src/lib/validators";

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

describe("validateImportPath", () => {
  it("accepts alias and relative specifiers", () => {
    expect(validateImportPath("@core/tokens")).toBeUndefined();
    expect(validateImportPath("../core/tokens")).toBeUndefined();
    expect(validateImportPath("src/app/core")).toBeUndefined();
  });
  it("rejects empty", () => {
    expect(validateImportPath("   ")).toMatch(/import path/);
  });
  it("rejects string-literal breakout characters", () => {
    expect(validateImportPath('@core/tokens"; eval(1); //')).toMatch(/only/);
    expect(validateImportPath("a';b")).toMatch(/only/);
    expect(validateImportPath("a b")).toMatch(/only/);
  });
});

describe("validateIdentifier", () => {
  it("accepts valid identifiers", () => {
    expect(validateIdentifier("AUTH_TOKEN")).toBeUndefined();
    expect(validateIdentifier("_x1")).toBeUndefined();
  });
  it("rejects invalid", () => {
    expect(validateIdentifier("1token")).toMatch(/identifier/);
    expect(validateIdentifier("a-b")).toMatch(/identifier/);
  });
});
