import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { unzipSync, zipSync, type Zippable } from 'fflate';
import { ExerciseError, loadExercise } from '@jide/shared';
import { AppError } from '../errors.js';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
export const MAX_ENTRIES = 500;

export interface ValidatedPackage {
  /** Exercise id from exercise.yaml. */
  id: string;
  title: string;
  /** Normalised zip: a single folder `<id>/` with the exercise inside. */
  zip: Uint8Array;
  /** sha256 hex of `zip`. */
  version: string;
}

const invalid = (message: string) => new AppError(400, 'INVALID_EXERCISE', message);

/** Names are rejected (not silently fixed) when they could escape the extraction directory. */
function unsafeName(name: string): boolean {
  if (name.includes('\0') || name.includes('\\') || name.startsWith('/') || /^[a-zA-Z]:/.test(name)) return true;
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
  if (hasSymlink(zip)) throw invalid('Das ZIP enthält symbolische Links. Diese sind nicht erlaubt.');
  let entries = 0;
  let total = 0;
  let raw: Record<string, Uint8Array>;
  try {
    raw = unzipSync(zip, {
      // Runs before inflating; fflate never writes more than the declared size, so these caps bound memory.
      filter(file) {
        if (file.name.endsWith('/')) return false;
        if (unsafeName(file.name)) {
          throw invalid(`Ungültiger Dateipfad im ZIP: „${file.name}“. Pfade müssen relativ sein und dürfen kein „..“ enthalten.`);
        }
        if (isJunk(file.name)) return false;
        if (++entries > MAX_ENTRIES) throw invalid(`Das ZIP enthält zu viele Dateien (höchstens ${MAX_ENTRIES}).`);
        total += file.originalSize;
        if (total > MAX_UNCOMPRESSED_BYTES) {
          throw invalid(`Das ZIP ist entpackt zu groß (höchstens ${MAX_UNCOMPRESSED_BYTES / 1024 / 1024} MB).`);
        }
        return true;
      },
    });
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw invalid('Die Datei ist kein gültiges ZIP-Archiv.');
  }
  return new Map(Object.entries(raw));
}

/** Finds the exercise root: files at the zip root, or one single top-level folder. Returns the path prefix. */
function exercisePrefix(files: Map<string, Uint8Array>): string {
  if (files.has('exercise.yaml')) return '';
  const tops = new Set([...files.keys()].map((n) => n.split('/')[0]!));
  const top = tops.size === 1 ? [...tops][0]! : undefined;
  if (top && files.has(`${top}/exercise.yaml`)) return `${top}/`;
  throw invalid(
    'Datei exercise.yaml fehlt. Sie muss im ZIP direkt oder in genau einem Aufgabenordner liegen (z. B. summe/exercise.yaml).'
  );
}

/** Validates an uploaded zip with the shared exercise parser and returns the normalised package. */
export async function validatePackage(upload: Uint8Array): Promise<ValidatedPackage> {
  const files = unpack(upload);
  if (files.size === 0) throw invalid('Das ZIP ist leer.');
  const prefix = exercisePrefix(files);

  const tmp = await mkdtemp(path.join(tmpdir(), 'jide-upload-'));
  try {
    const dir = path.join(tmp, prefix ? prefix.slice(0, -1) : 'aufgabe');
    const inner = new Map<string, Uint8Array>();
    for (const [name, data] of files) {
      if (!name.startsWith(prefix)) continue;
      const rel = name.slice(prefix.length);
      const target = path.resolve(dir, rel);
      if (!target.startsWith(path.resolve(dir) + path.sep)) throw invalid(`Ungültiger Dateipfad im ZIP: „${name}“.`);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, data);
      inner.set(rel, data);
    }

    let exercise;
    try {
      exercise = await loadExercise(dir);
    } catch (e) {
      if (e instanceof ExerciseError) throw invalid(e.message);
      throw e;
    }

    // Deterministic re-pack (sorted, fixed timestamps): identical content gives an identical version.
    const mtime = new Date(1980, 0, 1, 0, 0, 0);
    const zippable: Zippable = {};
    for (const rel of [...inner.keys()].sort()) zippable[`${exercise.id}/${rel}`] = [inner.get(rel)!, { level: 6, mtime }];
    const zip = zipSync(zippable);
    return {
      id: exercise.id,
      title: exercise.title,
      zip,
      version: createHash('sha256').update(zip).digest('hex'),
    };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
