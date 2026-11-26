import { stat } from "node:fs/promises";
import { join } from "node:path";
import { app, ipcMain } from "electron";
import { ExerciseError, openWorkspace, resetFile, saveFile, type Exercise, type HandInFile } from "@jide/shared";
import type {
  ExerciseList,
  NewerHandIn,
  ExerciseSummary,
  HandInResult,
  OpenResult,
  SaveResult
} from "../shared-types/api";
import { context } from "./context";
import { gradedExercise } from "./graded";
import { examStudentName, examMode, testsAllowed } from "./exam-state";
import { examWorkspaceKey } from "./exam-store";
import { scratchEntry } from "./composite-source";
import { isScratchId, type ImportedInfo } from "./scratch";
import type { SourceEntry } from "./source";
import { decideNewerHandIn, hashFiles, setPendingHandIn, takePendingHandIn, type RemoteHandIn } from "./handin-sync";
import { parseTestSummary } from "./test-summary";

type Workspace = Awaited<ReturnType<typeof openWorkspace>>;

function editableOf(ws: Workspace): HandInFile[] {
  return ws.files.filter((f) => f.editable).map((f) => ({ path: f.path, content: f.content }));
}

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

async function summarise(exercises: SourceEntry[]): Promise<ExerciseSummary[]> {
  const { handIns } = context();
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
      groupId: ex.groupId,
      kind: ex.kind ?? null,
      ...(ex.grade ? { grade: ex.grade } : {}),
      ...(ex.scratch ? { scratch: true, classCount: ex.classCount ?? 0 } : {}),
      ...(ex.imported ? { imported: true, testCount: ex.testCount ?? 0, ...(ex.copied ? { copied: true } : {}) } : {})
    });
  }
  return summaries;
}

export function registerExerciseIpc(): void {
  ipcMain.handle("jide:list-exercises", async (): Promise<ExerciseList> => {
    const { source } = context();
    const { exercises, groups, errors, offline } = await source.list();
    return { exercises: await summarise(exercises), groups, errors, offline };
  });

  // Scratch only: never asks the backend (before login a 401 there would send the app to the code screen).
  ipcMain.handle("jide:list-scratch", async (): Promise<ExerciseList> => {
    const scratch = context().scratch;
    const { exercises, errors, imported } = scratch
      ? await scratch.list()
      : { exercises: [], errors: [], imported: new Map<string, ImportedInfo>() };
    return {
      exercises: await summarise(exercises.map((e) => scratchEntry(e, imported.get(e.id)))),
      groups: [],
      errors,
      offline: false
    };
  });

  async function opened(ex: Exercise, ws: Workspace, newerHandIn?: NewerHandIn): Promise<OpenResult> {
    const { source, handIns } = context();
    const importedInfo = await context().scratch?.importedInfo(ex.id);
    return {
      ok: true,
      exercise: {
        id: ex.id,
        title: ex.title,
        assignment: ex.assignment,
        mainFile: ex.mainFile,
        files: ws.files,
        // Images come from the exercise package, not from the student's workspace.
        images: ex.images.map((i) => ({ path: i.path, title: i.title, svg: ex.imageContents[i.path] ?? "" })),
        deadline: await source.deadlineOf(ex.id),
        submittedAt: handIns.get(ex.id)?.submittedAt ?? null,
        late: handIns.get(ex.id)?.late ?? false,
        hasTests: (ex.tests?.length ?? 0) > 0,
        ...(isScratchId(ex.id) ? { scratch: true } : {}),
        ...(importedInfo ? { importedFiles: importedInfo.files } : {})
      },
      ...(newerHandIn ? { newerHandIn } : {})
    };
  }

  ipcMain.handle("jide:open-exercise", async (_e, id: unknown): Promise<OpenResult> => {
    const { source, handIns } = context();
    const ex = await findExercise(id);
    if (!ex) return { ok: false, message: UNKNOWN_EXERCISE };
    try {
      const graded = await source.gradedView?.(ex.id);
      if (graded && !graded.ok) return { ok: false, message: graded.message };
      if (graded) return { ok: true, exercise: gradedExercise(ex, graded.grade, await source.deadlineOf(ex.id)) };
      const existed = await dirExists(join(workspaceRoot(), ex.id));
      const prepared = await source.prepareWorkspace(ex, workspaceRoot(), existed);
      if (!prepared.ok) return { ok: false, message: prepared.message };
      let ws = await openWorkspace(ex, workspaceRoot());
      if (prepared.submittedAt) {
        // Fresh restore from the server: this is the sync point.
        handIns.set(ex.id, prepared.submittedAt, prepared.late === true, hashFiles(editableOf(ws)));
      } else if (existed && source.kind === "online" && !isScratchId(ex.id) && !examMode()) {
        // A hand-in made on another device may be newer than this laptop's draft (SPEC 3.6).
        const latest = (await source.fetchLatestHandIn?.(ex)) ?? null;
        const decision = decideNewerHandIn({
          latest,
          known: handIns.get(ex.id),
          local: editableOf(ws),
          starter: ex.files.filter((f) => f.editable).map((f) => ({ path: f.path, content: ex.originals[f.path] ?? "" }))
        });
        if (latest && decision === "record") {
          handIns.set(ex.id, latest.submittedAt, latest.late, hashFiles(editableOf(ws)));
        } else if (latest && decision === "replace") {
          ws = await applyHandIn(ex, latest);
        } else if (latest && decision === "ask") {
          setPendingHandIn(ex.id, latest);
          return opened(ex, ws, { submittedAt: latest.submittedAt, late: latest.late });
        }
      }
      return opened(ex, ws);
    } catch (e) {
      return { ok: false, message: errorMessage(e, "Die Aufgabe konnte nicht geöffnet werden.") };
    }
  });

  /** Writes the hand-in over the editable files and makes it this laptop's sync point. */
  async function applyHandIn(ex: Exercise, h: RemoteHandIn): Promise<Workspace> {
    for (const f of h.files) await saveFile(ex, workspaceRoot(), f.path, f.content);
    const ws = await openWorkspace(ex, workspaceRoot());
    context().handIns.set(ex.id, h.submittedAt, h.late, hashFiles(editableOf(ws)));
    return ws;
  }

  // The student's answer to "Neuere Abgabe von einem anderen Gerät": the pending hand-in was kept by the open call above.
  ipcMain.handle("jide:resolve-newer-hand-in", async (_e, id: unknown, choice: unknown): Promise<OpenResult> => {
    if (typeof id !== "string" || (choice !== "load" && choice !== "keep")) return { ok: false, message: "Ungültige Anfrage." };
    const ex = await findExercise(id);
    if (!ex) return { ok: false, message: UNKNOWN_EXERCISE };
    try {
      const h = takePendingHandIn(ex.id);
      let ws: Workspace;
      if (h && choice === "load") ws = await applyHandIn(ex, h);
      else {
        // Keep: remember that this hand-in was seen (so it is not asked again); the sync point stays.
        if (h) context().handIns.set(ex.id, h.submittedAt, h.late);
        ws = await openWorkspace(ex, workspaceRoot());
      }
      return opened(ex, ws);
    } catch (e) {
      return { ok: false, message: errorMessage(e, "Die Abgabe konnte nicht geladen werden.") };
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
    if (r.ok) handIns.set(ex.id, r.submittedAt, r.late, hashFiles(files));
    // Graded while the exercise was open: refresh the list (and its cache) so the exercise is graded from now on.
    else if (r.graded) await source.list().catch(() => undefined);
    return r;
  });
}
