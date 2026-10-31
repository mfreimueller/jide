import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { listExercises, type Exercise, type HandInFile } from "@jide/shared";

/** One exercise as the source knows it. */
export interface SourceEntry {
  id: string;
  title: string;
  /** ISO 8601 UTC or null. */
  deadline: string | null;
}

export interface SourceListing {
  exercises: SourceEntry[];
  /** German loading errors. */
  errors: string[];
  /** The source is remote and could not be reached; the entries come from its cache. */
  offline: boolean;
}

export type HandInOutcome = { ok: true; submittedAt: string; late: boolean } | { ok: false; message: string };

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
  ): Promise<{ ok: true; submittedAt?: string } | { ok: false; message: string }>;
  /** Present when the source accepts hand-ins. */
  handIn?(ex: Exercise, files: HandInFile[]): Promise<HandInOutcome>;
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
      exercises: exercises.map((e) => ({ id: e.id, title: e.title, deadline: null })),
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

  async prepareWorkspace(): Promise<{ ok: true }> {
    return { ok: true };
  }
}
