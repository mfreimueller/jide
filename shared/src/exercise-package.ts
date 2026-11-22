import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { unzipSync } from "fflate";
import { ExerciseError, loadExercise, type Exercise, type ParseOptions } from "./exercise.js";

export const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
export const MAX_ENTRIES = 500;
/** Largest accepted zip file (upload by a teacher, import by a student). */
export const MAX_PACKAGE_BYTES = 10 * 1024 * 1024;

/** Some Windows tools (PowerShell 5.1 `Compress-Archive`) write `\` as the separator; treat it as `/`. */
function entryName(name: string): string {
  return name.replace(/\\/g, '/');
}

/** Names (after `entryName`) are rejected, not silently fixed, when they could escape the extraction directory. */
function unsafeName(name: string): boolean {
  if (name.includes('\0') || name.startsWith('/') || /^[a-zA-Z]:/.test(name)) return true;
  const segments = name.replace(/\/$/, '').split('/');
  return segments.some((s) => s === '' || s === '.' || s === '..');
}

function isJunk(name: string): boolean {
  return name.startsWith('__MACOSX/') || name.split('/').pop() === '.DS_Store';
}

/** Reads the central directory and reports whether any entry is a Unix symlink (fflate does not expose that). */
export function hasSymlink(zip: Uint8Array): boolean {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return false; // fflate will reject it as a broken zip
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  for (let n = 0; n < count; n++) {
    if (p + 46 > zip.length || dv.getUint32(p, true) !== 0x02014b50) return false;
    const host = dv.getUint16(p + 4, true) >> 8;
    const mode = dv.getUint32(p + 38, true) >>> 16;
    if (host === 3 && (mode & 0xf000) === 0xa000) return true;
    p += 46 + dv.getUint16(p + 28, true) + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
  }
  return false;
}

function unpack(zip: Uint8Array): Map<string, Uint8Array> {
  if (hasSymlink(zip)) throw new ExerciseError('Das ZIP enthält symbolische Links. Diese sind nicht erlaubt.');
  let entries = 0;
  let total = 0;
  let raw: Record<string, Uint8Array>;
  try {
    raw = unzipSync(zip, {
      // Runs before inflating; fflate never writes more than the declared size, so these caps bound memory.
      filter(file) {
        const name = entryName(file.name);
        if (name.endsWith('/')) return false;
        if (unsafeName(name)) {
          throw new ExerciseError(`Ungültiger Dateipfad im ZIP: „${file.name}“. Pfade müssen relativ sein und dürfen kein „..“ enthalten.`);
        }
        if (isJunk(name)) return false;
        if (++entries > MAX_ENTRIES) throw new ExerciseError(`Das ZIP enthält zu viele Dateien (höchstens ${MAX_ENTRIES}).`);
        total += file.originalSize;
        if (total > MAX_UNCOMPRESSED_BYTES) {
          throw new ExerciseError(`Das ZIP ist entpackt zu groß (höchstens ${MAX_UNCOMPRESSED_BYTES / 1024 / 1024} MB).`);
        }
        return true;
      },
    });
  } catch (e) {
    if (e instanceof ExerciseError) throw e;
    throw new ExerciseError('Die Datei ist kein gültiges ZIP-Archiv.');
  }
  const files = new Map<string, Uint8Array>();
  for (const [rawName, data] of Object.entries(raw)) {
    const name = entryName(rawName);
    if (files.has(name)) throw new ExerciseError(`Die Datei „${name}“ kommt im ZIP doppelt vor.`);
    files.set(name, data);
  }
  return files;
}

/** Finds the exercise root: files at the zip root, or one single top-level folder. Returns the path prefix. */
function exercisePrefix(files: Map<string, Uint8Array>): string {
  if (files.has('exercise.yaml')) return '';
  const tops = new Set([...files.keys()].map((n) => n.split('/')[0]!));
  const top = tops.size === 1 ? [...tops][0]! : undefined;
  if (top && files.has(`${top}/exercise.yaml`)) return `${top}/`;
  throw new ExerciseError(
    'Datei exercise.yaml fehlt. Sie muss im ZIP direkt oder in genau einem Aufgabenordner liegen (z. B. summe/exercise.yaml).'
  );
}

export interface ReadPackage {
  exercise: Exercise;
  /** Every file of the package, relative to the exercise root (junk like __MACOSX removed). */
  files: Map<string, Uint8Array>;
}

/**
 * Unpacks an exercise zip (files at the root or in one top-level folder), rejects unsafe paths, symlinks and
 * oversize archives, and validates the content with `loadExercise`. Throws ExerciseError with a German message.
 * Shared by the teacher upload (backend) and the student import (app).
 */
export async function readExerciseZip(zip: Uint8Array, opts: ParseOptions = {}): Promise<ReadPackage> {
  const files = unpack(zip);
  if (files.size === 0) throw new ExerciseError("Das ZIP ist leer.");
  const prefix = exercisePrefix(files);

  const tmp = await mkdtemp(path.join(tmpdir(), "jide-package-"));
  try {
    const dir = path.join(tmp, prefix ? prefix.slice(0, -1) : "aufgabe");
    const inner = new Map<string, Uint8Array>();
    for (const [name, data] of files) {
      if (!name.startsWith(prefix)) continue;
      const rel = name.slice(prefix.length);
      const target = path.resolve(dir, rel);
      if (!target.startsWith(path.resolve(dir) + path.sep)) throw new ExerciseError(`Ungültiger Dateipfad im ZIP: „${name}“.`);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, data);
      inner.set(rel, data);
    }
    return { exercise: await loadExercise(dir, opts), files: inner };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
