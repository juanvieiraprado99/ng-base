import crypto from "node:crypto";
import path from "node:path";
import fse from "fs-extra";

export const NGX_BASE_MANIFEST_FILENAME = ".ngx-base-cli.manifest.json";

export interface ManifestEntry {
  hash: string;
  template: string;
}

export interface Manifest {
  version: number;
  files: Record<string, ManifestEntry>;
}

/** Sync state of a generated file relative to its manifest record and the freshly rendered content. */
export type SyncStatus = "absent" | "in-sync" | "drift" | "edited";

const MANIFEST_VERSION = 1;

export function manifestPath(cwd: string): string {
  return path.join(cwd, NGX_BASE_MANIFEST_FILENAME);
}

export function sha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/** Normalize an absolute target path to a posix-style path relative to cwd (manifest key). */
export function manifestKey(cwd: string, absPath: string): string {
  return path.relative(cwd, absPath).split(path.sep).join("/");
}

export async function readManifest(cwd: string): Promise<Manifest> {
  const p = manifestPath(cwd);
  if (!(await fse.pathExists(p))) {
    return { version: MANIFEST_VERSION, files: {} };
  }
  try {
    const raw = await fse.readFile(p, "utf8");
    const parsed = JSON.parse(raw) as Partial<Manifest>;
    return {
      version: parsed.version ?? MANIFEST_VERSION,
      files: parsed.files ?? {},
    };
  } catch {
    return { version: MANIFEST_VERSION, files: {} };
  }
}

export async function writeManifest(
  cwd: string,
  manifest: Manifest,
): Promise<void> {
  const ordered: Manifest = {
    version: MANIFEST_VERSION,
    files: Object.fromEntries(
      Object.entries(manifest.files).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      ),
    ),
  };
  await fse.writeFile(
    manifestPath(cwd),
    `${JSON.stringify(ordered, null, 2)}\n`,
    "utf8",
  );
}

/**
 * Classify a target by comparing disk, manifest, and freshly-rendered content.
 *
 * - `absent`  — file is not on disk
 * - `in-sync` — disk already matches the rendered template
 * - `drift`   — disk is pristine CLI output but the template would now produce
 *               something different (config changed); safe to overwrite
 * - `edited`  — disk differs from what the CLI last wrote; overwriting loses
 *               the user's local changes
 */
export function classifyTarget(
  diskContent: string | null,
  renderedContent: string,
  manifestHash: string | undefined,
): SyncStatus {
  if (diskContent === null) return "absent";
  const diskHash = sha256(diskContent);
  if (diskHash === sha256(renderedContent)) return "in-sync";
  if (manifestHash === undefined) {
    // No record (legacy install or manually added file): cannot prove a local
    // edit, so treat as drift and let the normal update flow handle it.
    return "drift";
  }
  return diskHash === manifestHash ? "drift" : "edited";
}
