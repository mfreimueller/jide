import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { listExercises, type Difficulty, type Exercise, type HandInFile, type StudentExerciseGroup, type StudentGrade, type StudentGradeResponse, type TestSummary } from "@jide/shared";

/** One exercise as the source knows it. */
export interface SourceEntry {
  id: string;
  title: string;
  /** ISO 8601 UTC or null. */
  deadline: string | null;
  /** Exercise group of the course, null = none. */
  groupId: number | null;
  /** From exercise.yaml (or the backend list), null/missing = none. */
  difficulty?: Difficulty | null;
  /** Set once the exercise is graded (online source). */
  grade?: StudentGrade | null;
  /** A Scratch item (own program without a server), listed in its own section. */
  scratch?: boolean;
  /** Scratch items: number of .java files. */
  classCount?: number;
  /** Scratch items made by "Aufgabe importieren": no hand-in, tests from tests.yaml. */
  imported?: boolean;
  /** Imported items: number of tests (0 without tests.yaml). */
  testCount?: number;
  /** Imported items made by "In Scratch kopieren". */
  copied?: boolean;
}

export interface SourceListing {
  exercises: SourceEntry[];
  /** Groups in the teacher's order (remote source only). */
  groups: StudentExerciseGroup[];
  /** German loading errors. */
  errors: string[];
  /** The source is remote and could not be reached; the entries come from its cache. */
  offline: boolean;
}

export type HandInOutcome = { ok: true; submittedAt: string; late: boolean } | { ok: false; message: string; graded?: boolean };

/** null = the exercise is not graded. */
export type GradedViewResult = null | { ok: true; grade: StudentGradeResponse } | { ok: false; message: string };

/**
 * Where exercises come from. Local folder (dev, e2e), backend (online mode) and later the
 * exam folder (M4) implement this; everything else in the main process only talks to it.
 */
export interface ExerciseSource {
  readonly kind: "local" | "online";
  /** Lists the exercises; a remote source also refreshes its cache. */
  list(): Promise<SourceListing>;
  /** Deadline of an exercise from what is known locally (no network); null if none. */
  deadlineOf(id: string): Promise<string | null>;
  /** Resolves an id to an exercise on disk without touching the network. */
  find(id: unknown): Promise<Exercise | undefined>;
  /**
   * Called before the workspace of an exercise is opened. A source may seed a workspace that does
   * not exist yet (online: the last hand-in on a new laptop). `workspaceExists` is true if the
   * student has worked on it here already. Returns the submission time to remember, if any.
   */
  prepareWorkspace(
    ex: Exercise,
    workspaceRoot: string,
    workspaceExists: boolean
  ): Promise<{ ok: true; submittedAt?: string; late?: boolean } | { ok: false; message: string }>;
  /** Online source: the graded hand-in of a graded exercise (from the cache when offline); null if not graded. */
  gradedView?(id: string): Promise<GradedViewResult>;
  /** Present when the source accepts hand-ins. */
  handIn?(ex: Exercise, files: HandInFile[], testSummary: TestSummary | null): Promise<HandInOutcome>;
}

async function dirExists(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/** Exercises from a folder (`JIDE_EXERCISES_DIR`). */
export class LocalSource implements ExerciseSource {
  readonly kind = "local" as const;
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private async loadAll(): Promise<{ exercises: Exercise[]; errors: string[] }> {
    if (!(await dirExists(this.root))) {
      return { exercises: [], errors: [`Aufgabenordner nicht gefunden: ${this.root}`] };
    }
    const { exercises, errors } = await listExercises(this.root);
    return { exercises, errors: errors.map((e) => e.message) };
  }

  async list(): Promise<SourceListing> {
    const { exercises, errors } = await this.loadAll();
    return {
      exercises: exercises.map((e) => ({ id: e.id, title: e.title, deadline: null, groupId: null, difficulty: e.difficulty ?? null })),
      groups: [],
      errors,
      offline: false
    };
  }

  async find(id: unknown): Promise<Exercise | undefined> {
    if (typeof id !== "string") return undefined;
    return (await this.loadAll()).exercises.find((e) => e.id === id);
  }

  async deadlineOf(): Promise<string | null> {
    return null;
  }

  async prepareWorkspace(
    _ex?: Exercise,
    _workspaceRoot?: string,
    _workspaceExists?: boolean
  ): Promise<{ ok: true; submittedAt?: string; late?: boolean } | { ok: false; message: string }> {
    return { ok: true };
  }
}
