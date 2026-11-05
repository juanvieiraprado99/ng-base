import { describe, expect, it } from "vitest";
import { applyTemplate, renderConditionals } from "../src/lib/templates";

const API_CLIENT_VARS = {
  IMPORT_API_TOKENS: "@core/tokens/api.tokens",
  IMPORT_CACHE_INTERCEPTOR: "@core/interceptors/cache.interceptor",
  IMPORT_CACHE_SERVICE: "./cache.service",
};

describe("applyTemplate", () => {
  it("replaces provided tokens", async () => {
    const out = await applyTemplate("api-client.ts.tpl", {
      ...API_CLIENT_VARS,
      HTTP_RESOURCE: "false",
    });
    expect(out).toContain("@core/tokens/api.tokens");
    expect(out).not.toMatch(/\{\{[#/A-Z0-9_ ]+\}\}/);
  });

  it("throws on unreplaced tokens", async () => {
    await expect(applyTemplate("api-client.ts.tpl", {})).rejects.toThrow(
      /unreplaced token/i,
    );
  });

  it("includes the httpResource block only when HTTP_RESOURCE is true", async () => {
    const off = await applyTemplate("api-client.ts.tpl", {
      ...API_CLIENT_VARS,
      HTTP_RESOURCE: "false",
    });
    expect(off).not.toContain("httpResource");
    const on = await applyTemplate("api-client.ts.tpl", {
      ...API_CLIENT_VARS,
      HTTP_RESOURCE: "true",
    });
    expect(on).toContain("resource<T>(");
    expect(on).toContain("  httpResource,\n");
  });
});

describe("renderConditionals", () => {
  it("keeps or drops blocks without leaving blank marker lines", () => {
    const tpl = "a\n{{#if X}}\nb\n{{/if}}\nc\n";
    expect(renderConditionals(tpl, { X: "true" })).toBe("a\nb\nc\n");
    expect(renderConditionals(tpl, { X: "false" })).toBe("a\nc\n");
    expect(renderConditionals(tpl, {})).toBe("a\nc\n");
  });
});
