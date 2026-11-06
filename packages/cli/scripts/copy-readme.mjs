// npm shows the README that sits inside the published package, so copy the
// root one next to package.json before `npm publish` (gitignored).
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const from = fileURLToPath(new URL("../../../README.md", import.meta.url));
const to = fileURLToPath(new URL("../README.md", import.meta.url));
copyFileSync(from, to);
console.log("README.md copied into packages/cli");
