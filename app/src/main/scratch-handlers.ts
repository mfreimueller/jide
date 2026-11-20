import type { Exercise } from "@jide/shared";
import { isScratchId, type ScratchResult, type ScratchStore } from "./scratch";

/** The package is not on this laptop (offline and never downloaded) or the exercise is gone. */
export const COPY_UNAVAILABLE_MESSAGE = "Die Aufgabe ist gerade nicht verfügbar. Verbinde dich mit dem Internet und versuche es noch einmal.";
export const SCRATCH_NOT_ALLOWED_MESSAGE = "Scratch gibt es in der Prüfung nicht.";

/**
 * What the Scratch IPC channels do. `store()` is undefined in exam mode, where every call is refused.
 * Kept free of Electron so it can be tested directly.
 */
export function scratchHandlers(
  store: () => ScratchStore | undefined,
  workspaceRoot: () => string,
  findExercise: (id: unknown) => Promise<Exercise | undefined> = async () => undefined
) {
  const refuse = { ok: false as const, message: SCRATCH_NOT_ALLOWED_MESSAGE };
  return {
    create: (title: unknown): Promise<ScratchResult<{ id: string }>> | { ok: false; message: string } =>
      store()?.create(title) ?? refuse,
    rename: (id: unknown, title: unknown): Promise<ScratchResult> | { ok: false; message: string } =>
      store()?.rename(id, title) ?? refuse,
    delete: (id: unknown): Promise<ScratchResult> | { ok: false; message: string } =>
      store()?.delete(id, workspaceRoot()) ?? refuse,
    addClass: (id: unknown, name: unknown): Promise<ScratchResult<{ path: string }>> | { ok: false; message: string } =>
      store()?.addClass(id, name) ?? refuse,
    deleteClass: (id: unknown, path: unknown): Promise<ScratchResult> | { ok: false; message: string } =>
      store()?.deleteClass(id, path, workspaceRoot()) ?? refuse,
    /** `pick` shows the file dialog and returns the chosen path (undefined = canceled). */
    chooseAssignment: async (id: unknown, pick: () => Promise<string | undefined>): Promise<ScratchResult<{ canceled?: boolean }>> => {
      const s = store();
      if (!s) return refuse;
      const path = await pick();
      return path === undefined ? { ok: true, canceled: true } : s.pickAssignment(id, path);
    },
    /** `pick` shows the dialog for a folder or a zip and returns the chosen path (undefined = canceled). */
    importExercise: async (
      kind: unknown,
      pick: (kind: "folder" | "zip") => Promise<string | undefined>
    ): Promise<ScratchResult<{ id?: string; canceled?: boolean }>> => {
      const s = store();
      if (!s) return refuse;
      if (kind !== "folder" && kind !== "zip") return { ok: false, message: "Ungültige Anfrage." };
      const path = await pick(kind);
      return path === undefined ? { ok: true, canceled: true } : s.importExercise(kind, path);
    },
    importPath: (kind: unknown, path: unknown): Promise<ScratchResult<{ id: string }>> | { ok: false; message: string } =>
      store()?.importExercise(kind, path) ?? refuse,
    /** Copies a server exercise into Scratch; `mode` is "fresh" (starter files) or "mine" (the student's code). */
    copyExercise: async (id: unknown, mode: unknown): Promise<ScratchResult<{ id: string }>> => {
      const s = store();
      if (!s) return refuse;
      const ex = isScratchId(id) ? undefined : await findExercise(id); // only server exercises
      if (!ex) return { ok: false, message: COPY_UNAVAILABLE_MESSAGE };
      return s.copyExercise(ex, mode, workspaceRoot());
    },
    pickAssignment: (id: unknown, path: unknown): Promise<ScratchResult> | { ok: false; message: string } =>
      store()?.pickAssignment(id, path) ?? refuse
  };
}
