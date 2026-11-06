import ts from "typescript";
import { describe, expect, it } from "vitest";
import { applyTemplate } from "../src/lib/templates";

type IsAllowedUrl = (url: string, allowed: string, base: string) => boolean;
type FakeRequest = { url: string; context: { get(token: unknown): unknown } };
type IsAuthRequest = (req: FakeRequest, allowed: readonly string[]) => boolean;

/** Compile and run the exact helpers the CLI writes into projects. */
async function loadHelpers(): Promise<{
  isAllowedUrl: IsAllowedUrl;
  isAuthRequest: IsAuthRequest;
  SKIP_AUTH: object;
}> {
  const source = await applyTemplate("auth.tokens.ts.tpl", {
    IMPORT_API_TOKENS: "./api.tokens",
  });
  const start = source.indexOf("export function isAllowedUrl");
  if (start === -1) throw new Error("isAllowedUrl not found in template");
  const fn = source.slice(start).replaceAll("export function", "function");
  const js = ts.transpile(fn, { target: ts.ScriptTarget.ES2022 });
  return new Function(
    `const SKIP_AUTH = {}; ${js}; return { isAllowedUrl, isAuthRequest, SKIP_AUTH };`,
  )();
}

async function loadIsAllowedUrl(): Promise<IsAllowedUrl> {
  return (await loadHelpers()).isAllowedUrl;
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

describe("isAuthRequest (auth.tokens template)", () => {
  it("authenticates allowlisted requests unless skipAuth() is set", async () => {
    const { isAuthRequest, SKIP_AUTH } = await loadHelpers();
    const req = (url: string, skip = false): FakeRequest => ({
      url,
      context: { get: (t) => (t === SKIP_AUTH ? skip : undefined) },
    });
    const allowed = ["https://api.example.com"];
    expect(isAuthRequest(req("https://api.example.com/me"), allowed)).toBe(
      true,
    );
    expect(
      isAuthRequest(req("https://api.example.com/login", true), allowed),
    ).toBe(false);
    expect(isAuthRequest(req("https://maps.other.com/tiles"), allowed)).toBe(
      false,
    );
    expect(isAuthRequest(req("https://api.example.com/me"), [])).toBe(false);
  });
});
