import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Sources use NodeNext-style explicit `.js` import specifiers (e.g. `./config.js`).
 * Vite does not map those to the sibling `.ts` by default, so do it here.
 */
const resolveJsToTs = {
  name: "resolve-js-to-ts",
  enforce: "pre" as const,
  resolveId(source: string, importer: string | undefined) {
    if (importer && source.startsWith(".") && source.endsWith(".js")) {
      const candidate = resolve(dirname(importer), source.replace(/\.js$/, ".ts"));
      if (existsSync(candidate)) return candidate;
    }
    return null;
  },
};

export default defineConfig({
  plugins: [resolveJsToTs],
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
