import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { ExerciseError } from "./errors.js";
import { parseTestsConfig, type TestCase } from "./tests.js";

export { ExerciseError };

const exerciseSchema = z.object({
  id: z
    .string({ error: "id fehlt oder ist kein Text" })
    .regex(/^[a-z0-9-]+$/, { error: "id darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten" }),
  title: z.string({ error: "title fehlt oder ist kein Text" }).min(1, { error: "title darf nicht leer sein" }),
  files: z
    .array(
      z.object({
        path: z.string({ error: "path fehlt oder ist kein Text" }),
        editable: z.boolean({ error: "editable muss true oder false sein" }).default(true),
      }),
      { error: "files fehlt oder ist keine Liste" },
    )
    .min(1, { error: "files darf nicht leer sein" }),
  harness: z
    .object({
      appendTo: z.string({ error: "harness.appendTo fehlt oder ist kein Text" }),
      file: z.string({ error: "harness.file fehlt oder ist kein Text" }),
    })
    .optional(),
  mainFile: z.string({ error: "mainFile fehlt oder ist kein Text" }),
  images: z
    .array(
      z.object({
        path: z.string({ error: "path fehlt oder ist kein Text" }),
        title: z.string({ error: "title muss ein Text sein" }).optional(),
      }),
      { error: "images muss eine Liste sein" },
    )
    .optional(),
});

/** Maximum size of one SVG image in bytes. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type ExerciseConfig = z.infer<typeof exerciseSchema>;
export type ExerciseFile = ExerciseConfig["files"][number];
export interface ExerciseImage {
  path: string;
  title?: string;
}

export interface Exercise extends Omit<ExerciseConfig, "images"> {
  /** Read-only SVG images from files/ (empty when exercise.yaml has no images:). */
  images: ExerciseImage[];
  /** SVG text of every image, keyed by its path. Kept apart from originals: images are never Java files. */
  imageContents: Record<string, string>;
  /** Path of the exercise folder, as given to loadExercise. */
  dir: string;
  /** Raw content of aufgabe.md. */
  assignment: string;
  /** Content of the harness file, if the exercise has one. */
  harnessContent?: string;
  /** Original content of every listed file, keyed by its path from exercise.yaml. */
  originals: Record<string, string>;
  /** Parsed tests.yaml; undefined when the exercise has none. */
  tests?: TestCase[];
}

async function isFile(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

function hasParentSegment(p: string): boolean {
  return p.split(/[\\/]/).includes("..");
}

function isAbsoluteAnywhere(p: string): boolean {
  return path.posix.isAbsolute(p) || path.win32.isAbsolute(p);
}

function svgPathProblem(p: string): string | undefined {
  if (p.length === 0) return "ist leer";
  if (isAbsoluteAnywhere(p)) return "muss relativ sein";
  if (hasParentSegment(p)) return 'darf kein ".." enthalten';
  if (!p.endsWith(".svg")) return "muss auf .svg enden";
  return undefined;
}

function javaPathProblem(p: string): string | undefined {
  if (p.length === 0) return "ist leer";
  if (isAbsoluteAnywhere(p)) return "muss relativ sein";
  if (hasParentSegment(p)) return 'darf kein ".." enthalten';
  if (!p.endsWith(".java")) return "muss auf .java enden";
  return undefined;
}

/** Parses and validates the text of an exercise.yaml (no file access). Throws ExerciseError with a German message. */
export function parseExerciseConfig(raw: string, name = "?"): ExerciseConfig {
  const fail = (problem: string): never => {
    throw new ExerciseError(`Aufgabe "${name}": ${problem}`);
  };
  let data: unknown;
  try {
    data = parseYaml(raw);
  } catch (e) {
    const detail = e instanceof Error ? e.message.split("\n")[0] : String(e);
    return fail(`exercise.yaml ist kein gültiges YAML (${detail}).`);
  }

  const parsed = exerciseSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const where = issue.path.length > 0 ? ` (${issue.path.join(".")})` : "";
    return fail(`exercise.yaml ist ungültig: ${issue.message}${where}.`);
  }
  const config = parsed.data;

  const seen = new Set<string>();
  for (const f of config.files) {
    const problem = javaPathProblem(f.path);
    if (problem) fail(`Dateipfad "${f.path}" ${problem}.`);
    if (seen.has(f.path)) fail(`Dateipfad "${f.path}" ist doppelt aufgeführt.`);
    seen.add(f.path);
  }
  if (!seen.has(config.mainFile)) fail(`mainFile "${config.mainFile}" ist nicht in files aufgeführt.`);
  if (config.harness && !seen.has(config.harness.appendTo)) {
    fail(`harness.appendTo "${config.harness.appendTo}" ist nicht in files aufgeführt.`);
  }
  const seenImages = new Set<string>();
  for (const img of config.images ?? []) {
    const problem = svgPathProblem(img.path);
    if (problem) fail(`Bildpfad "${img.path}" ${problem}.`);
    if (seenImages.has(img.path)) fail(`Bildpfad "${img.path}" ist doppelt aufgeführt.`);
    if (seen.has(img.path)) fail(`Bildpfad "${img.path}" steht auch in files.`);
    seenImages.add(img.path);
  }
  return config;
}

export async function loadExercise(dir: string): Promise<Exercise> {
  const name = path.basename(path.resolve(dir));
  const fail = (problem: string): never => {
    throw new ExerciseError(`Aufgabe "${name}": ${problem}`);
  };

  let raw: string;
  try {
    raw = await readFile(path.join(dir, "exercise.yaml"), "utf8");
  } catch {
    return fail("Datei exercise.yaml fehlt.");
  }

  const config = parseExerciseConfig(raw, name);

  const originals: Record<string, string> = {};
  for (const f of config.files) {
    const full = path.join(dir, "files", f.path);
    if (!(await isFile(full))) fail(`Datei files/${f.path} fehlt.`);
    originals[f.path] = await readFile(full, "utf8");
  }

  const imageContents: Record<string, string> = {};
  for (const img of config.images ?? []) {
    const full = path.join(dir, "files", img.path);
    if (!(await isFile(full))) fail(`Bilddatei files/${img.path} fehlt.`);
    const buf = await readFile(full);
    if (buf.length > MAX_IMAGE_BYTES) fail(`Bilddatei files/${img.path} ist größer als 2 MB.`);
    imageContents[img.path] = buf.toString("utf8");
  }

  let harnessContent: string | undefined;
  if (config.harness) {
    const hp = config.harness.file;
    if (isAbsoluteAnywhere(hp) || hasParentSegment(hp) || !(await isFile(path.join(dir, hp)))) {
      fail(`Harness-Datei ${hp} fehlt.`);
    }
    harnessContent = await readFile(path.join(dir, hp), "utf8");
  }

  let assignment: string;
  try {
    assignment = await readFile(path.join(dir, "aufgabe.md"), "utf8");
  } catch {
    return fail("Datei aufgabe.md fehlt.");
  }

  let tests: TestCase[] | undefined;
  const testsPath = path.join(dir, "tests.yaml");
  if (await isFile(testsPath)) tests = parseTestsConfig(await readFile(testsPath, "utf8"), name);

  return { ...config, images: config.images ?? [], imageContents, dir, assignment, harnessContent, originals, tests };
}

export async function listExercises(
  rootDir: string,
): Promise<{ exercises: Exercise[]; errors: ExerciseError[] }> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const exercises: Exercise[] = [];
  const errors: ExerciseError[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(rootDir, entry.name);
    if (!(await isFile(path.join(dir, "exercise.yaml")))) continue;
    try {
      exercises.push(await loadExercise(dir));
    } catch (e) {
      if (e instanceof ExerciseError) errors.push(e);
      else throw e;
    }
  }
  exercises.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { exercises, errors };
}
