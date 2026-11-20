import { randomBytes } from "node:crypto";
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  ExerciseError,
  listExercises,
  loadExercise,
  MAX_PACKAGE_BYTES,
  parseExerciseConfig,
  readExerciseZip,
  type Exercise
} from "@jide/shared";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

/** Every Scratch id starts with this, so it can never clash with a server exercise id. */
export const SCRATCH_PREFIX = "scratch-";

const SCRATCH_ID = /^scratch-[a-f0-9]{12}$/;
const MAIN_FILE = "Main.java";
const MAX_TITLE = 80;
const MAX_ASSIGNMENT_BYTES = 1024 * 1024;
/** Remembers what an import brought along: the classes that cannot be deleted and the number of tests. */
const IMPORTED_FILE = "imported.json";

export interface ImportedInfo {
  /** Paths (as in exercise.yaml) of the classes that came with the exercise. */
  files: string[];
  tests: number;
}

export type ScratchResult<T = unknown> = ({ ok: true } & T) | { ok: false; message: string };

export function isScratchId(id: unknown): id is string {
  return typeof id === "string" && SCRATCH_ID.test(id);
}

const JAVA_RESERVED = new Set(
  (
    "abstract assert boolean break byte case catch char class const continue default do double else enum extends " +
    "final finally float for goto if implements import instanceof int interface long native new package private " +
    "protected public return short static strictfp super switch synchronized this throw throws transient try void " +
    "volatile while true false null _ var yield record sealed permits"
  ).split(" ")
);

/** German problem with a class name, or undefined if it is usable. */
export function classNameProblem(name: unknown): string | undefined {
  if (typeof name !== "string" || name.trim() === "") return "Bitte gib einen Klassennamen ein.";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    return "Ein Klassenname darf nur Buchstaben (ohne Umlaute), Ziffern und _ enthalten und nicht mit einer Ziffer beginnen.";
  }
  if (JAVA_RESERVED.has(name)) return `„${name}“ ist in Java ein reserviertes Wort und kann kein Klassenname sein.`;
  return undefined;
}

function titleOf(title: unknown): { ok: true; title: string } | { ok: false; message: string } {
  const t = typeof title === "string" ? title.trim() : "";
  if (t === "") return { ok: false, message: "Bitte gib einen Namen ein." };
  if (t.length > MAX_TITLE) return { ok: false, message: `Der Name darf höchstens ${MAX_TITLE} Zeichen lang sein.` };
  return { ok: true, title: t };
}

const MAIN_SOURCE = "void main() {\n\n}\n";

function classSource(name: string): string {
  return `class ${name} {\n}\n`;
}

const UNKNOWN = "Dieses Programm gibt es nicht.";
const FAILED = "Das hat leider nicht geklappt.";

async function writeAtomic(target: string, content: string): Promise<void> {
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(tmp, content, "utf8");
    await rename(tmp, target);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
}

/**
 * Scratch items: programs the student writes without a server. Each one is a normal exercise
 * package in `<root>/<id>/` (exercise.yaml, files/, aufgabe.md) that `loadExercise` reads. Nothing here
 * touches the network. The editable copy lives in the workspace like for every other exercise
 * (`openWorkspace` copies files that do not exist there yet and never overwrites).
 */
export class ScratchStore {
  private readonly root: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(root: string) {
    this.root = resolve(root);
  }

  /** Changes to one store must not overlap (two quick clicks would race on exercise.yaml). */
  private serial<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private dir(id: string): string {
    return join(this.root, id);
  }

  async list(): Promise<{ exercises: Exercise[]; errors: string[]; imported: Map<string, ImportedInfo> }> {
    try {
      const r = await listExercises(this.root);
      const exercises = r.exercises.filter((e) => isScratchId(e.id));
      const imported = new Map<string, ImportedInfo>();
      for (const e of exercises) {
        const info = await this.importedInfo(e.id);
        if (info) imported.set(e.id, info);
      }
      return { exercises, errors: r.errors.map((e) => e.message), imported };
    } catch {
      return { exercises: [], errors: [], imported: new Map() }; // no scratch folder yet
    }
  }

  async find(id: unknown): Promise<Exercise | undefined> {
    if (!isScratchId(id)) return undefined;
    try {
      const ex = await loadExercise(this.dir(id));
      return ex.id === id ? ex : undefined;
    } catch {
      return undefined;
    }
  }

  /** Reads exercise.yaml as a plain object so that later fields (tests, images from an import) survive edits. */
  private async readConfig(id: string): Promise<Record<string, unknown>> {
    return parseYaml(await readFile(join(this.dir(id), "exercise.yaml"), "utf8")) as Record<string, unknown>;
  }

  private async writeConfig(id: string, config: Record<string, unknown>): Promise<void> {
    const text = stringifyYaml(config);
    parseExerciseConfig(text, id); // never write something the parser would refuse
    await writeAtomic(join(this.dir(id), "exercise.yaml"), text);
  }

  private fail(e: unknown): { ok: false; message: string } {
    return { ok: false, message: e instanceof ExerciseError ? e.message : FAILED };
  }

  create(title: unknown): Promise<ScratchResult<{ id: string }>> {
    return this.serial(async () => {
      const t = titleOf(title);
      if (!t.ok) return t;
      const id = `${SCRATCH_PREFIX}${randomBytes(6).toString("hex")}`;
      const dir = this.dir(id);
      try {
        await mkdir(join(dir, "files"), { recursive: true });
        await writeFile(join(dir, "files", MAIN_FILE), MAIN_SOURCE, "utf8");
        await writeFile(join(dir, "aufgabe.md"), "", "utf8");
        await this.writeConfig(id, { id, title: t.title, files: [{ path: MAIN_FILE, editable: true }], mainFile: MAIN_FILE });
        return { ok: true, id };
      } catch (e) {
        await rm(dir, { recursive: true, force: true });
        return this.fail(e);
      }
    });
  }

  rename(id: unknown, title: unknown): Promise<ScratchResult> {
    return this.serial(async () => {
      if (!(await this.find(id))) return { ok: false, message: UNKNOWN };
      const t = titleOf(title);
      if (!t.ok) return t;
      try {
        const config = await this.readConfig(id as string);
        config["title"] = t.title;
        await this.writeConfig(id as string, config);
        return { ok: true };
      } catch (e) {
        return this.fail(e);
      }
    });
  }

  /** Removes the package and the student's workspace copy. */
  delete(id: unknown, workspaceRoot: string): Promise<ScratchResult> {
    return this.serial(async () => {
      if (!isScratchId(id) || !(await isDir(this.dir(id)))) return { ok: false, message: UNKNOWN };
      try {
        await rm(this.dir(id), { recursive: true, force: true });
        await rm(join(workspaceRoot, id), { recursive: true, force: true });
        return { ok: true };
      } catch (e) {
        return this.fail(e);
      }
    });
  }

  addClass(id: unknown, name: unknown): Promise<ScratchResult<{ path: string }>> {
    return this.serial(async () => {
      const ex = await this.find(id);
      if (!ex) return { ok: false, message: UNKNOWN };
      const problem = classNameProblem(name);
      if (problem) return { ok: false, message: problem };
      const file = `${name as string}.java`;
      // Case-insensitive: Windows would treat Foo.java and foo.java as one file.
      if (ex.files.some((f) => f.path.toLowerCase() === file.toLowerCase())) {
        return { ok: false, message: `Die Klasse „${name as string}“ gibt es schon.` };
      }
      try {
        const config = await this.readConfig(ex.id);
        const files = config["files"] as unknown[];
        files.push({ path: file, editable: true });
        await writeFile(join(this.dir(ex.id), "files", file), classSource(name as string), "utf8");
        await this.writeConfig(ex.id, config);
        return { ok: true, path: file };
      } catch (e) {
        await rm(join(this.dir(ex.id), "files", file), { force: true });
        return this.fail(e);
      }
    });
  }

  /** `Main.java`, the main file and the classes of an imported exercise are never deleted. */
  deleteClass(id: unknown, path: unknown, workspaceRoot: string): Promise<ScratchResult> {
    return this.serial(async () => {
      const ex = await this.find(id);
      if (!ex) return { ok: false, message: UNKNOWN };
      if (typeof path !== "string" || !ex.files.some((f) => f.path === path)) {
        return { ok: false, message: "Diese Datei gibt es nicht." };
      }
      if (path === MAIN_FILE || path === ex.mainFile) {
        return { ok: false, message: `${path} ist die Hauptdatei und kann nicht gelöscht werden.` };
      }
      if ((await this.importedInfo(ex.id))?.files.includes(path)) {
        return { ok: false, message: `${path} gehört zur importierten Aufgabe und kann nicht gelöscht werden.` };
      }
      try {
        const config = await this.readConfig(ex.id);
        config["files"] = (config["files"] as { path: string }[]).filter((f) => f.path !== path);
        await this.writeConfig(ex.id, config);
        await rm(join(this.dir(ex.id), "files", path), { force: true });
        await rm(join(workspaceRoot, ex.id, path), { force: true });
        return { ok: true };
      } catch (e) {
        return this.fail(e);
      }
    });
  }

  /** What an import brought along; undefined for items the student created. */
  async importedInfo(id: unknown): Promise<ImportedInfo | undefined> {
    if (!isScratchId(id)) return undefined;
    try {
      const j = JSON.parse(await readFile(join(this.dir(id), IMPORTED_FILE), "utf8")) as Partial<ImportedInfo>;
      if (!Array.isArray(j.files)) return undefined;
      return { files: j.files.filter((f): f is string => typeof f === "string"), tests: typeof j.tests === "number" ? j.tests : 0 };
    } catch {
      return undefined;
    }
  }

  /**
   * Imports a teacher-format exercise (a folder, or a zip with the files at its root or in one top-level folder)
   * as a new Scratch item. Validation is the same parser as for the teacher upload (`loadExercise` /
   * `readExerciseZip`). Importing the same exercise twice gives two items.
   */
  importExercise(kind: unknown, source: unknown): Promise<ScratchResult<{ id: string }>> {
    return this.serial(async () => {
      if ((kind !== "folder" && kind !== "zip") || typeof source !== "string" || source === "") {
        return { ok: false, message: "Ungültige Anfrage." };
      }
      let ex: Exercise;
      let testsYaml: string | undefined;
      try {
        if (kind === "folder") {
          if (!(await isDir(source))) return { ok: false, message: "Der Ordner wurde nicht gefunden." };
          ex = await loadExercise(source);
          testsYaml = await readFile(join(source, "tests.yaml"), "utf8").catch(() => undefined);
        } else {
          const st = await stat(source);
          if (!st.isFile()) return { ok: false, message: "Die Datei wurde nicht gefunden." };
          if (st.size > MAX_PACKAGE_BYTES) {
            return { ok: false, message: `Die Datei ist zu groß (höchstens ${MAX_PACKAGE_BYTES / 1024 / 1024} MB).` };
          }
          const pkg = await readExerciseZip(new Uint8Array(await readFile(source)));
          ex = pkg.exercise;
          const raw = pkg.files.get("tests.yaml");
          testsYaml = raw === undefined ? undefined : Buffer.from(raw).toString("utf8");
        }
      } catch (e) {
        if (e instanceof ExerciseError) return { ok: false, message: e.message };
        const code = (e as NodeJS.ErrnoException).code;
        return { ok: false, message: code === "ENOENT" ? "Die Datei wurde nicht gefunden." : "Die Datei konnte nicht gelesen werden." };
      }

      return this.install(ex, testsYaml, {});
    });
  }

  /** Writes `ex` (plus tests.yaml) as a new Scratch item. `overrides` replaces the starter content of editable files. Call inside `serial`. */
  private async install(
    ex: Exercise,
    testsYaml: string | undefined,
    overrides: Record<string, string>
  ): Promise<ScratchResult<{ id: string }>> {
    const id = `${SCRATCH_PREFIX}${randomBytes(6).toString("hex")}`;
    const dir = this.dir(id);
    try {
      // Written from the validated exercise, so only what exercise.yaml lists is copied.
      const put = async (rel: string, content: string): Promise<void> => {
        await mkdir(dirname(join(dir, rel)), { recursive: true });
        await writeFile(join(dir, rel), content, "utf8");
      };
      for (const [path, content] of Object.entries({ ...ex.originals, ...overrides })) await put(join("files", path), content);
      for (const [path, content] of Object.entries(ex.imageContents)) await put(join("files", path), content);
      if (ex.harness && ex.harnessContent !== undefined) await put(ex.harness.file, ex.harnessContent);
      await put("aufgabe.md", ex.assignment);
      if (testsYaml !== undefined) await put("tests.yaml", testsYaml);
      const config: Record<string, unknown> = {
        id,
        title: ex.title,
        files: ex.files.map((f) => ({ path: f.path, editable: f.editable })),
        mainFile: ex.mainFile
      };
      if (ex.harness) config["harness"] = ex.harness;
      if (ex.images.length > 0) config["images"] = ex.images;
      if (ex.difficulty) config["difficulty"] = ex.difficulty;
      await mkdir(dir, { recursive: true });
      await this.writeConfig(id, config);
      await loadExercise(dir); // what was written must load again
      const info: ImportedInfo = { files: ex.files.map((f) => f.path), tests: ex.tests?.length ?? 0 };
      await writeFile(join(dir, IMPORTED_FILE), JSON.stringify(info), "utf8");
      return { ok: true, id };
    } catch (e) {
      await rm(dir, { recursive: true, force: true });
      return this.fail(e);
    }
  }

  /**
   * Copies a server exercise into Scratch like an import. `fresh` uses the package's starter files, `mine` the
   * student's working copy of the editable files (starter file where there is none yet). Reads only; the
   * workspace of the original is not touched.
   */
  copyExercise(ex: Exercise | undefined, mode: unknown, workspaceRoot: string): Promise<ScratchResult<{ id: string }>> {
    return this.serial(async () => {
      if (!ex) return { ok: false, message: "Diese Aufgabe gibt es nicht." };
      if (mode !== "fresh" && mode !== "mine") return { ok: false, message: "Ungültige Anfrage." };
      try {
        const testsYaml = await readFile(join(ex.dir, "tests.yaml"), "utf8").catch(() => undefined);
        const content: Record<string, string> = {};
        if (mode === "mine") {
          for (const f of ex.files) {
            if (!f.editable) continue;
            const mine = await readFile(join(workspaceRoot, ex.id, f.path), "utf8").catch(() => undefined);
            if (mine !== undefined) content[f.path] = mine;
          }
        }
        return await this.install(ex, testsYaml, content);
      } catch (e) {
        return this.fail(e);
      }
    });
  }

  /** Copies the Markdown file at `source` into the item as aufgabe.md (replaces an existing one). */
  pickAssignment(id: unknown, source: unknown): Promise<ScratchResult> {
    return this.serial(async () => {
      if (!(await this.find(id))) return { ok: false, message: UNKNOWN };
      if (typeof source !== "string" || !/\.md$/i.test(source)) {
        return { ok: false, message: "Bitte wähle eine Markdown-Datei (.md)." };
      }
      try {
        const st = await stat(source);
        if (!st.isFile()) return { ok: false, message: "Die Datei wurde nicht gefunden." };
        if (st.size > MAX_ASSIGNMENT_BYTES) return { ok: false, message: "Die Datei ist zu groß (höchstens 1 MB)." };
        const tmp = join(this.dir(id as string), `aufgabe.md.${process.pid}.tmp`);
        await copyFile(source, tmp);
        await rename(tmp, join(this.dir(id as string), "aufgabe.md"));
        return { ok: true };
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        return { ok: false, message: code === "ENOENT" ? "Die Datei wurde nicht gefunden." : "Die Datei konnte nicht gelesen werden." };
      }
    });
  }
}

async function isDir(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}
