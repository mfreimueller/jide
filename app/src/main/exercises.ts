import { stat } from "node:fs/promises";
import { join } from "node:path";
import { app, ipcMain } from "electron";
import { ExerciseError, openWorkspace, resetFile, saveFile, type Exercise } from "@jide/shared";
import type {
  ExerciseList,
  ExerciseSummary,
  HandInResult,
  OpenResult,
  SaveResult
} from "../shared-types/api";
import { context } from "./context";
import { examStudentName, examMode, testsAllowed } from "./exam-state";
import { examWorkspaceKey } from "./exam-store";
import { parseTestSummary } from "./test-summary";

const MAX_CONTENT_BYTES = 2 * 1024 * 1024;

/**
 * Where the editable files live. Exam mode: one folder per exam and student below userData (in
 * %TEMP%), so an earlier exam or another student on the same Windows account never leaks in.
 */
export function workspaceRoot(): string {
  const base = join(app.getPath("userData"), "workspaces");
  const exam = examMode();
  if (!exam?.config) return base;
  return join(base, examWorkspaceKey(exam.dir, exam.config.title, examStudentName() ?? ""));
}

async function dirExists(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/** Only ids that belong to a currently known exercise are accepted. */
export function findExercise(id: unknown): Promise<Exercise | undefined> {
  return context().source.find(id);
}

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ExerciseError) return e.message;
  const code = (e as NodeJS.ErrnoException | undefined)?.code;
  return code ? `${fallback} (${code})` : fallback;
}

const UNKNOWN_EXERCISE = "Diese Aufgabe gibt es nicht.";

export function registerExerciseIpc(): void {
  ipcMain.handle("jide:list-exercises", async (): Promise<ExerciseList> => {
    const { source, handIns } = context();
    const { exercises, groups, errors, offline } = await source.list();
    const summaries: ExerciseSummary[] = [];
    for (const ex of exercises) {
      const started = await dirExists(join(workspaceRoot(), ex.id));
      const handIn = handIns.get(ex.id);
      const submittedAt = handIn?.submittedAt ?? null;
      summaries.push({
        id: ex.id,
        title: ex.title,
        status: submittedAt ? "abgegeben" : started ? "in-arbeit" : "neu",
        deadline: ex.deadline,
        submittedAt,
        late: handIn?.late ?? false,
        groupId: ex.groupId
      });
    }
    return { exercises: summaries, groups, errors, offline };
  });

  ipcMain.handle("jide:open-exercise", async (_e, id: unknown): Promise<OpenResult> => {
    const { source, handIns } = context();
    const ex = await findExercise(id);
    if (!ex) return { ok: false, message: UNKNOWN_EXERCISE };
    try {
      const prepared = await source.prepareWorkspace(
        ex,
        workspaceRoot(),
        await dirExists(join(workspaceRoot(), ex.id))
      );
      if (!prepared.ok) return { ok: false, message: prepared.message };
      if (prepared.submittedAt) handIns.set(ex.id, prepared.submittedAt, prepared.late === true);
      const ws = await openWorkspace(ex, workspaceRoot());
      return {
        ok: true,
        exercise: {
          id: ex.id,
          title: ex.title,
          assignment: ex.assignment,
          mainFile: ex.mainFile,
          files: ws.files,
          deadline: await source.deadlineOf(ex.id),
          submittedAt: handIns.get(ex.id)?.submittedAt ?? null,
          late: handIns.get(ex.id)?.late ?? false,
          hasTests: (ex.tests?.length ?? 0) > 0
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

  ipcMain.handle("jide:hand-in", async (_e, id: unknown, testSummary: unknown): Promise<HandInResult> => {
    const { source, handIns } = context();
    if (!source.handIn) return { ok: false, message: "Abgeben ist hier nicht möglich." };
    const ex = await findExercise(id);
    if (!ex) return { ok: false, message: UNKNOWN_EXERCISE };
    let files;
    try {
      // The saved files are handed in; the renderer has flushed its pending edits before asking.
      const ws = await openWorkspace(ex, workspaceRoot());
      files = ws.files.filter((f) => f.editable).map((f) => ({ path: f.path, content: f.content }));
    } catch (e) {
      return { ok: false, message: errorMessage(e, "Deine Dateien konnten nicht gelesen werden.") };
    }
    const r = await source.handIn(ex, files, ex.tests?.length && testsAllowed() ? parseTestSummary(testSummary) : null);
    if (r.ok) handIns.set(ex.id, r.submittedAt, r.late);
    return r;
  });
}
