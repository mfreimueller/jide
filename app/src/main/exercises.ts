import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { app, ipcMain } from "electron";
import {
  ExerciseError,
  listExercises,
  openWorkspace,
  resetFile,
  saveFile,
  type Exercise
} from "@jide/shared";
import type {
  ExerciseList,
  ExerciseSummary,
  OpenResult,
  SaveResult
} from "../shared-types/api";

const MAX_CONTENT_BYTES = 2 * 1024 * 1024;

/** Env override, otherwise the repo's examples/ folder (the app folder is app/ in dev). */
function exercisesRoot(): string {
  const fromEnv = process.env["JIDE_EXERCISES_DIR"];
  if (fromEnv) return resolve(fromEnv);
  return resolve(app.getAppPath(), "..", "examples");
}

function workspaceRoot(): string {
  return join(app.getPath("userData"), "workspaces");
}

async function dirExists(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function loadAll(): Promise<{ exercises: Exercise[]; errors: string[] }> {
  const root = exercisesRoot();
  if (!(await dirExists(root))) {
    return { exercises: [], errors: [`Aufgabenordner nicht gefunden: ${root}`] };
  }
  const { exercises, errors } = await listExercises(root);
  return { exercises, errors: errors.map((e) => e.message) };
}

/** Only ids that belong to a currently known exercise are accepted. */
export async function findExercise(id: unknown): Promise<Exercise | undefined> {
  if (typeof id !== "string") return undefined;
  const { exercises } = await loadAll();
  return exercises.find((e) => e.id === id);
}

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ExerciseError) return e.message;
  const code = (e as NodeJS.ErrnoException | undefined)?.code;
  return code ? `${fallback} (${code})` : fallback;
}

const UNKNOWN_EXERCISE = "Diese Aufgabe gibt es nicht.";

export function registerExerciseIpc(): void {
  ipcMain.handle("jide:list-exercises", async (): Promise<ExerciseList> => {
    const { exercises, errors } = await loadAll();
    const summaries: ExerciseSummary[] = [];
    for (const ex of exercises) {
      const started = await dirExists(join(workspaceRoot(), ex.id));
      summaries.push({ id: ex.id, title: ex.title, status: started ? "in-arbeit" : "neu" });
    }
    return { exercises: summaries, errors };
  });

  ipcMain.handle("jide:open-exercise", async (_e, id: unknown): Promise<OpenResult> => {
    const ex = await findExercise(id);
    if (!ex) return { ok: false, message: UNKNOWN_EXERCISE };
    try {
      const ws = await openWorkspace(ex, workspaceRoot());
      return {
        ok: true,
        exercise: {
          id: ex.id,
          title: ex.title,
          assignment: ex.assignment,
          mainFile: ex.mainFile,
          files: ws.files
        }
      };
    } catch (e) {
      return { ok: false, message: errorMessage(e, "Die Aufgabe konnte nicht geöffnet werden.") };
    }
  });

  ipcMain.handle(
    "jide:save-file",
    async (_e, id: unknown, path: unknown, content: unknown): Promise<SaveResult> => {
      if (typeof path !== "string" || typeof content !== "string") {
        return { ok: false, message: "Ungültige Anfrage." };
      }
      if (Buffer.byteLength(content, "utf8") > MAX_CONTENT_BYTES) {
        return { ok: false, message: "Die Datei ist zu groß zum Speichern." };
      }
      const ex = await findExercise(id);
      if (!ex) return { ok: false, message: UNKNOWN_EXERCISE };
      try {
        await saveFile(ex, workspaceRoot(), path, content);
        return { ok: true };
      } catch (e) {
        return { ok: false, message: errorMessage(e, "Die Datei konnte nicht gespeichert werden.") };
      }
    }
  );

  ipcMain.handle("jide:reset-file", async (_e, id: unknown, path: unknown): Promise<SaveResult> => {
    if (typeof path !== "string") return { ok: false, message: "Ungültige Anfrage." };
    const ex = await findExercise(id);
    if (!ex) return { ok: false, message: UNKNOWN_EXERCISE };
    try {
      await resetFile(ex, workspaceRoot(), path);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: errorMessage(e, "Die Datei konnte nicht zurückgesetzt werden.") };
    }
  });
}
