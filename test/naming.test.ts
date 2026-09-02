import { describe, expect, it } from "vitest";
import {
  camelName,
  kebabName,
  pascalName,
  symbolName,
} from "../src/lib/naming";

describe("name transforms", () => {
  it("kebabName", () => {
    expect(kebabName("UserProfile")).toBe("user-profile");
    expect(kebabName("user profile")).toBe("user-profile");
    expect(kebabName("  --user--  ")).toBe("user");
    expect(kebabName("user_profile")).toBe("user-profile");
    expect(kebabName("APIKey")).toBe("api-key");
    expect(kebabName("userAPI")).toBe("user-api");
  });
  it("pascalName", () => {
    expect(pascalName("user-profile")).toBe("UserProfile");
    expect(pascalName("user_profile")).toBe("UserProfile");
    expect(pascalName("userProfile")).toBe("UserProfile");
    expect(pascalName("APIKey")).toBe("ApiKey");
  });
  it("camelName", () => {
    expect(camelName("user-profile")).toBe("userProfile");
    expect(camelName("UserProfile")).toBe("userProfile");
  });
});

describe("symbolName", () => {
  it("class suffix for service/component", () => {
    expect(symbolName("user-profile", "service")).toBe("UserProfileService");
    expect(symbolName("user", "component")).toBe("UserComponent");
  });
  it("camel + suffix for guard/resolver", () => {
    expect(symbolName("auth", "guard")).toBe("authGuard");
    expect(symbolName("user-data", "resolver")).toBe("userDataResolver");
  });
  it("falls back to Feature for empty-ish input", () => {
    expect(symbolName("---", "service")).toBe("FeatureService");
  });
  it("class suffix for pipe/directive/store", () => {
    expect(symbolName("user", "pipe")).toBe("UserPipe");
    expect(symbolName("highlight", "directive")).toBe("HighlightDirective");
    expect(symbolName("cart", "store")).toBe("CartStore");
  });
  it("no suffix for interface/enum", () => {
    expect(symbolName("user-profile", "interface")).toBe("UserProfile");
    expect(symbolName("order-status", "enum")).toBe("OrderStatus");
  });
});
