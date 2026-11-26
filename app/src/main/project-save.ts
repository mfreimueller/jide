import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildExerciseZip, ExerciseError, openWorkspace, type Exercise } from "@jide/shared";
import type { ProjectSaveResult } from "../shared-types/api";
import type { GradedViewResult } from "./source";

export const PROJECT_SAVE_NOT_ALLOWED_MESSAGE = "Speichern unter gibt es in der Prüfung nicht.";
const UNKNOWN = "Diese Aufgabe gibt es nicht.";

/** Default file name of the save dialog: the title with everything unsafe for a file name replaced, plus ".zip". */
export function projectFileName(title: unknown): string {
  const base = (typeof title === "string" ? title : "")
    .replace(/[^\p{L}\p{N} ._-]/gu, "_")
    .replace(/\s+/g, " ")
    .replace(/^[\s._]+|[\s.]+$/g, "")
    .slice(0, 60)
    .trim();
  return `${base || "programm"}.zip`;
}

export interface ProjectSaveDeps {
  examMode: () => boolean;
  /** Only ids of known exercises resolve; the renderer never passes a path. */
  find: (id: unknown) => Promise<Exercise | undefined>;
  workspaceRoot: () => string;
  /** Graded exercise: its graded hand-in is what the student sees (null = not graded). */
  gradedView: (id: string) => Promise<GradedViewResult>;
  /** Shows the save dialog with this default file name; undefined = canceled. */
  pick: (defaultName: string) => Promise<string | undefined>;
  write: (path: string, bytes: Uint8Array) => Promise<void>;
}

/** The student's current editable files: the graded hand-in, or the saved workspace (the renderer flushed first). */
async function currentFiles(ex: Exercise, d: ProjectSaveDeps): Promise<{ ok: true; files: Record<string, string> } | { ok: false; message: string }> {
  const g = await d.gradedView(ex.id);
  if (g && !g.ok) return g;
  if (g) return { ok: true, files: Object.fromEntries(g.grade.files.map((f) => [f.path, f.content])) };
  const ws = await openWorkspace(ex, d.workspaceRoot());
  return { ok: true, files: Object.fromEntries(ws.files.filter((f) => f.editable).map((f) => [f.path, f.content])) };
}

/**
 * "Speichern unter …": the open project as an exercise zip that "Importieren" reads back (the student's
 * current code replaces the starter code). Refused in exam mode. Kept free of Electron so it can be tested.
 */
export async function saveProject(id: unknown, d: ProjectSaveDeps): Promise<ProjectSaveResult> {
  if (d.examMode()) return { ok: false, message: PROJECT_SAVE_NOT_ALLOWED_MESSAGE };
  const ex = await d.find(id);
  if (!ex) return { ok: false, message: UNKNOWN };
  let bytes: Uint8Array;
  try {
    const current = await currentFiles(ex, d);
    if (!current.ok) return current;
    const testsYaml = await readFile(join(ex.dir, "tests.yaml"), "utf8").catch(() => undefined);
    bytes = buildExerciseZip(ex, current.files, testsYaml);
  } catch (e) {
    return { ok: false, message: e instanceof ExerciseError ? e.message : "Deine Dateien konnten nicht gelesen werden." };
  }
  const target = await d.pick(projectFileName(ex.title));
  if (target === undefined) return { ok: true, canceled: true };
  try {
    await d.write(target, bytes);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    return { ok: false, message: code ? `Die Datei konnte nicht gespeichert werden (${code}).` : "Die Datei konnte nicht gespeichert werden." };
  }
  return { ok: true };
}
