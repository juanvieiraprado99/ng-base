import path from "node:path";
import { describe, expect, it } from "vitest";
import { planArtifactFiles } from "../src/lib/artifact-plan";

const cwd = path.join("/", "proj");
const outDir = "src/app/core";

function posix(p: string): string {
  return p.split(path.sep).join("/");
}

describe("planArtifactFiles", () => {
  it("pipe lands under pipes/ with PIPE_NAME + CLASS_NAME", async () => {
    const res = await planArtifactFiles("pipe", "truncate-text", cwd, outDir);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const [f] = res.files;
    expect(posix(f.outPath)).toContain(
      "src/app/core/pipes/truncate-text.pipe.ts",
    );
    expect(f.vars).toMatchObject({
      CLASS_NAME: "TruncateTextPipe",
      PIPE_NAME: "truncateText",
    });
  });

  it("directive uses bracketed app-prefixed selector", async () => {
    const res = await planArtifactFiles("directive", "highlight", cwd, outDir);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.files[0].vars).toMatchObject({
      CLASS_NAME: "HighlightDirective",
      SELECTOR: "appHighlight",
    });
  });

  it("interface and enum land in their folders without suffix", async () => {
    const iface = await planArtifactFiles("interface", "user", cwd, outDir);
    const en = await planArtifactFiles("enum", "order-status", cwd, outDir);
    expect(iface.ok && en.ok).toBe(true);
    if (!iface.ok || !en.ok) return;
    expect(posix(iface.files[0].outPath)).toContain(
      "interfaces/user.interface.ts",
    );
    expect(iface.files[0].vars.CLASS_NAME).toBe("User");
    expect(posix(en.files[0].outPath)).toContain("enum/order-status.enum.ts");
    expect(en.files[0].vars.CLASS_NAME).toBe("OrderStatus");
  });

  it("component (default) emits ts + html + scss", async () => {
    const res = await planArtifactFiles("component", "user-card", cwd, outDir);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const names = res.files.map((f) => posix(f.outPath));
    expect(names.some((n) => n.endsWith("user-card.component.ts"))).toBe(true);
    expect(names.some((n) => n.endsWith("user-card.component.html"))).toBe(
      true,
    );
    expect(names.some((n) => n.endsWith("user-card.component.scss"))).toBe(
      true,
    );
    const ts = res.files[0];
    expect(ts.vars.TEMPLATE_FIELD).toContain("templateUrl");
    expect(ts.vars.STYLE_FIELD).toContain("styleUrl");
  });

  it("component --inline-template --style none emits only ts", async () => {
    const res = await planArtifactFiles("component", "user-card", cwd, outDir, {
      inlineTemplate: true,
      style: "none",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.files).toHaveLength(1);
    const ts = res.files[0];
    expect(ts.vars.TEMPLATE_FIELD).toContain("template:");
    expect(ts.vars.STYLE_FIELD).toBe("");
  });

  it("component --style css emits a .css stylesheet", async () => {
    const res = await planArtifactFiles("component", "user-card", cwd, outDir, {
      style: "css",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const names = res.files.map((f) => posix(f.outPath));
    expect(names.some((n) => n.endsWith("user-card.component.css"))).toBe(true);
    expect(res.files[0].vars.STYLE_FIELD).toContain(".css");
  });
});
