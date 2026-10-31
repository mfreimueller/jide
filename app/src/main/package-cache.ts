import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { unzipSync } from "fflate";
import { loadExercise, type ExerciseFile, type HandInFile, type StudentExerciseSummary } from "@jide/shared";

/** Exercise ids become folder names; only what exercise.yaml allows is accepted. */
export function isSafeExerciseId(id: unknown): id is string {
  return typeof id === "string" && /^[a-z0-9-]+$/.test(id);
}

/**
 * The cached package is current if the list announces the version we already hold and its folder
 * is there. Otherwise it is downloaded (with If-None-Match when a version is known).
 */
export function needsDownload(cachedVersion: string | undefined, serverVersion: string, folderPresent: boolean): boolean {
  return !folderPresent || cachedVersion !== serverVersion;
}

/**
 * New laptop: which files of the latest hand-in become the starting point?
 * Only files that are editable in the (current) exercise; anything else in the hand-in is ignored.
 * Returns undefined when the workspace exists already (never overwrite) or there is no hand-in.
 */
export function restorableFiles(
  workspaceExists: boolean,
  exerciseFiles: ExerciseFile[],
  latest: { files: HandInFile[] } | null
): HandInFile[] | undefined {
  if (workspaceExists || !latest) return undefined;
  const editable = new Set(exerciseFiles.filter((f) => f.editable).map((f) => f.path));
  const files = latest.files.filter((f) => editable.has(f.path));
  return files.length > 0 ? files : undefined;
}

function unsafeEntry(name: string): boolean {
  return (
    name.includes("\\") ||
    name.startsWith("/") ||
    /^[A-Za-z]:/.test(name) ||
    name.split("/").includes("..")
  );
}

/** Unzips a package (single folder `<id>/`, as the backend delivers it) into `destDir` without that folder. */
export function extractPackage(zip: Uint8Array, id: string): Map<string, Uint8Array> {
  const entries = unzipSync(zip);
  const prefix = `${id}/`;
  const out = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(entries)) {
    if (name.endsWith("/")) continue; // directory entry
    if (unsafeEntry(name)) throw new Error(`Unsicherer Pfad im Paket: ${name}`);
    if (!name.startsWith(prefix)) throw new Error(`Paket enthält Dateien außerhalb von ${prefix}`);
    out.set(name.slice(prefix.length), data);
  }
  if (!out.has("exercise.yaml")) throw new Error("Paket enthält keine exercise.yaml");
  return out;
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Layout under `root` (userData/cache):
 *   list.json              last GET /api/exercises answer
 *   exercises/<id>/        the unpacked package (exercise folder, loadExercise-compatible)
 *   exercises/<id>.version version (sha256 = ETag) of that folder; only the latest version is kept
 */
export class PackageCache {
  constructor(private readonly root: string) {}

  exerciseDir(id: string): string {
    return path.join(this.root, "exercises", id);
  }

  private versionFile(id: string): string {
    return path.join(this.root, "exercises", `${id}.version`);
  }

  async hasFolder(id: string): Promise<boolean> {
    return exists(path.join(this.exerciseDir(id), "exercise.yaml"));
  }

  async version(id: string): Promise<string | undefined> {
    try {
      return (await readFile(this.versionFile(id), "utf8")).trim() || undefined;
    } catch {
      return undefined;
    }
  }

  async readList(): Promise<StudentExerciseSummary[] | undefined> {
    try {
      const data: unknown = JSON.parse(await readFile(path.join(this.root, "list.json"), "utf8"));
      return Array.isArray(data) ? (data as StudentExerciseSummary[]) : undefined;
    } catch {
      return undefined;
    }
  }

  async writeList(list: StudentExerciseSummary[]): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const target = path.join(this.root, "list.json");
    const tmp = `${target}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(list), "utf8");
    await rename(tmp, target);
  }

  /**
   * Unpacks into a temp folder, validates it with the same parser the exercise has to pass
   * anywhere else, then swaps it in. The previous version stays untouched if anything fails.
   */
  async install(id: string, version: string, zip: Uint8Array): Promise<void> {
    const files = extractPackage(zip, id);
    const base = path.join(this.root, "exercises");
    const tmp = path.join(base, `${id}.new-${process.pid}`);
    const old = path.join(base, `${id}.old-${process.pid}`);
    await rm(tmp, { recursive: true, force: true });
    try {
      for (const [rel, data] of files) {
        const target = path.join(tmp, rel);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, data);
      }
      await loadExercise(tmp); // throws ExerciseError for a broken package
      const dir = this.exerciseDir(id);
      await rm(old, { recursive: true, force: true });
      if (await exists(dir)) await rename(dir, old);
      await rename(tmp, dir);
      await writeFile(this.versionFile(id), version, "utf8");
    } finally {
      await rm(tmp, { recursive: true, force: true });
      await rm(old, { recursive: true, force: true });
    }
  }
}
