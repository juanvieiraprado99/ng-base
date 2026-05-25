import { describe, expect, it } from "vitest";
import { camelName, kebabName, pascalName, symbolName } from "../src/lib/naming";

describe("name transforms", () => {
  it("kebabName", () => {
    expect(kebabName("UserProfile")).toBe("userprofile");
    expect(kebabName("user profile")).toBe("user-profile");
    expect(kebabName("  --user--  ")).toBe("user");
  });
  it("pascalName", () => {
    expect(pascalName("user-profile")).toBe("UserProfile");
    expect(pascalName("user_profile")).toBe("UserProfile");
  });
  it("camelName", () => {
    expect(camelName("user-profile")).toBe("userProfile");
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
});
