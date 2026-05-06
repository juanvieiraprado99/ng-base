import { cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
await cp(join(root, "src/templates"), join(root, "dist/templates"), {
  recursive: true,
});
