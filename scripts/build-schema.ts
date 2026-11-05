// Writes schema.json (JSON Schema for .ng-base.json) from CONFIG_FIELDS.
// Run via `npm run schema` (also part of `npm run build`).
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildConfigJsonSchema } from "../src/lib/config.js";

const out = fileURLToPath(new URL("../schema.json", import.meta.url));
writeFileSync(out, `${JSON.stringify(buildConfigJsonSchema(), null, 2)}\n`);
console.log("schema.json written");
