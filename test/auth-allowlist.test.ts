import ts from "typescript";
import { describe, expect, it } from "vitest";
import { applyTemplate } from "../src/lib/templates";

type IsAllowedUrl = (url: string, allowed: string, base: string) => boolean;

/** Compile and run the exact `isAllowedUrl` the CLI writes into projects. */
async function loadIsAllowedUrl(): Promise<IsAllowedUrl> {
  const source = await applyTemplate("auth.tokens.ts.tpl", {
    IMPORT_API_TOKENS: "./api.tokens",
  });
  const start = source.indexOf("export function isAllowedUrl");
  if (start === -1) throw new Error("isAllowedUrl not found in template");
  const fn = source.slice(start).replace("export function", "function");
  const js = ts.transpile(fn, { target: ts.ScriptTarget.ES2022 });
  return new Function(`${js}; return isAllowedUrl;`)() as IsAllowedUrl;
}

const BASE = "https://app.example.com";

describe("isAllowedUrl (auth.tokens template)", () => {
  it("matches the API origin and sub-paths", async () => {
    const allowed = await loadIsAllowedUrl();
    expect(
      allowed("https://api.example.com/users", "https://api.example.com", BASE),
    ).toBe(true);
    expect(
      allowed(
        "https://api.example.com/v1/users?x=1",
        "https://api.example.com/v1",
        BASE,
      ),
    ).toBe(true);
    expect(
      allowed(
        "https://api.example.com/v1",
        "https://api.example.com/v1/",
        BASE,
      ),
    ).toBe(true);
  });

  it("rejects look-alike hosts, other ports/protocols and sibling paths", async () => {
    const allowed = await loadIsAllowedUrl();
    expect(
      allowed(
        "https://api.example.com.attacker.io/x",
        "https://api.example.com",
        BASE,
      ),
    ).toBe(false);
    expect(
      allowed(
        "https://api.example.com@attacker.io/x",
        "https://api.example.com",
        BASE,
      ),
    ).toBe(false);
    expect(
      allowed("http://api.example.com/x", "https://api.example.com", BASE),
    ).toBe(false);
    expect(
      allowed(
        "https://api.example.com:8443/x",
        "https://api.example.com",
        BASE,
      ),
    ).toBe(false);
    expect(
      allowed(
        "https://api.example.com/v10/x",
        "https://api.example.com/v1",
        BASE,
      ),
    ).toBe(false);
  });

  it("resolves relative URLs against the app origin", async () => {
    const allowed = await loadIsAllowedUrl();
    expect(allowed("/api/users", "/api", BASE)).toBe(true);
    expect(allowed("/assets/i18n.json", "/api", BASE)).toBe(false);
    expect(allowed("/api/users", "https://api.example.com", BASE)).toBe(false);
  });
});
