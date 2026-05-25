import path from "node:path";
import fse from "fs-extra";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

const LOCKFILES: Record<string, PackageManager> = {
  "pnpm-lock.yaml": "pnpm",
  "yarn.lock": "yarn",
  "bun.lockb": "bun",
  "bun.lock": "bun",
  "package-lock.json": "npm",
};

/** Detect the package manager from lockfiles, then the npm_config_user_agent. */
export async function detectPackageManager(
  cwd: string,
): Promise<PackageManager> {
  for (const [file, pm] of Object.entries(LOCKFILES)) {
    if (await fse.pathExists(path.join(cwd, file))) return pm;
  }

  const ua = process.env.npm_config_user_agent ?? "";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";
  if (ua.startsWith("bun")) return "bun";

  return "npm";
}

/** The `npx`-equivalent runner for the detected package manager. */
export function dlxCommand(pm: PackageManager): string {
  switch (pm) {
    case "pnpm":
      return "pnpm dlx";
    case "yarn":
      return "yarn dlx";
    case "bun":
      return "bunx";
    default:
      return "npx";
  }
}
