import { createHash } from 'node:crypto';
import { zipSync, type Zippable } from 'fflate';
import { ExerciseError, MAX_ENTRIES, MAX_PACKAGE_BYTES, MAX_UNCOMPRESSED_BYTES, readExerciseZip, type Difficulty } from '@jide/shared';
import { AppError } from '../errors.js';

export const MAX_UPLOAD_BYTES = MAX_PACKAGE_BYTES;
export { MAX_ENTRIES, MAX_UNCOMPRESSED_BYTES };

export interface ValidatedPackage {
  /** Exercise id from exercise.yaml. */
  id: string;
  title: string;
  /** From exercise.yaml, null when not set. */
  difficulty: Difficulty | null;
  /** Normalised zip: a single folder `<id>/` with the exercise inside. */
  zip: Uint8Array;
  /** sha256 hex of `zip`. */
  version: string;
}

const invalid = (message: string) => new AppError(400, 'INVALID_EXERCISE', message);

/** Validates an uploaded zip with the shared exercise parser and returns the normalised package. */
export async function validatePackage(upload: Uint8Array): Promise<ValidatedPackage> {
  let pkg;
  try {
    pkg = await readExerciseZip(upload);
  } catch (e) {
    if (e instanceof ExerciseError) throw invalid(e.message);
    throw e;
  }
  const { exercise, files: inner } = pkg;
  if (exercise.id.startsWith('scratch-')) {
    throw invalid('Die id darf nicht mit „scratch-“ beginnen. Dieser Anfang ist für die Scratch-Programme der Schüler reserviert.');
  }

  // Deterministic re-pack (sorted, fixed timestamps): identical content gives an identical version.
  const mtime = new Date(1980, 0, 1, 0, 0, 0);
  const zippable: Zippable = {};
  for (const rel of [...inner.keys()].sort()) zippable[`${exercise.id}/${rel}`] = [inner.get(rel)!, { level: 6, mtime }];
  const zip = zipSync(zippable);
  return {
    id: exercise.id,
    title: exercise.title,
    difficulty: exercise.difficulty ?? null,
    zip,
    version: createHash('sha256').update(zip).digest('hex'),
  };
}
