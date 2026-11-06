import { describe, expect, it } from "vitest";
import { camelName, kebabName, pascalName } from "../src/lib/naming";

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
