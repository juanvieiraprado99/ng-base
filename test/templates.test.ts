import { describe, expect, it } from "vitest";
import { applyTemplate } from "../src/lib/templates";

describe("applyTemplate", () => {
  it("replaces provided tokens", async () => {
    const out = await applyTemplate("base.service.ts.tpl", {
      IMPORT_CACHE_INTERFACE: "@core/interfaces/cache.interface",
      SERVICE_DECORATOR: "@Injectable({ providedIn: 'root' })",
      SERVICE_DECORATOR_IMPORT: "Injectable",
    });
    expect(out).toContain("@core/interfaces/cache.interface");
    expect(out).not.toMatch(/\{\{[A-Z0-9_]+\}\}/);
  });

  it("throws on unreplaced tokens", async () => {
    await expect(applyTemplate("base.service.ts.tpl", {})).rejects.toThrow(
      /unreplaced token/i,
    );
  });
});
