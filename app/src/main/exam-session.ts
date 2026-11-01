import { ipcMain, type BrowserWindow } from "electron";
import { context } from "./context";
import { ExamSource } from "./exam-source";
import { examStudentName } from "./exam-state";
import { workspaceRoot } from "./exercises";

export const CLOSE_AUTOSAVE_TIMEOUT_MS = 3000;

function examSource(): ExamSource | undefined {
  const s = context().source;
  return s instanceof ExamSource ? s : undefined;
}

/** Copies the saved files of the given opened exercises (default: all) to the hand-in drive; no-op outside exam mode. */
export async function examAutosave(ids?: string[]): Promise<void> {
  await examSource()?.autosave(workspaceRoot(), ids);
}

/** After a run or a test run: save a copy without making the run wait for the drive. */
export function examAutosaveSoon(id: unknown): void {
  if (typeof id === "string") void examAutosave([id]).catch(() => undefined);
}

/** True while closing the window must ask first: exam mode, started, with changes not handed in. */
export async function examCloseNeedsConfirm(): Promise<boolean> {
  const source = examSource();
  if (!source || !examStudentName()) return false;
  // Best effort: a slow or broken drive must not keep the student from leaving.
  await Promise.race([examAutosave().catch(() => undefined), new Promise((r) => setTimeout(r, CLOSE_AUTOSAVE_TIMEOUT_MS))]);
  return source.hasUnsubmittedChanges(workspaceRoot()).catch(() => false);
}

/** Asks the renderer ("Wirklich beenden?"); resolves true if the student wants to leave. */
export function askToClose(win: BrowserWindow): Promise<boolean> {
  return new Promise((resolve) => {
    const onAnswer = (e: Electron.IpcMainEvent, leave: unknown): void => {
      if (e.sender !== win.webContents) return;
      ipcMain.removeListener("jide:close-answer", onAnswer);
      win.removeListener("closed", onClosed);
      resolve(leave === true);
    };
    const onClosed = (): void => {
      ipcMain.removeListener("jide:close-answer", onAnswer);
      resolve(true);
    };
    ipcMain.on("jide:close-answer", onAnswer);
    win.once("closed", onClosed);
    win.webContents.send("jide:confirm-close");
  });
}

export function registerExamSaveIpc(): void {
  ipcMain.handle("jide:exam-autosave", async (_e, ids: unknown): Promise<void> => {
    const list = Array.isArray(ids) && ids.every((i) => typeof i === "string") ? (ids as string[]) : undefined;
    await examAutosave(list);
  });
}
