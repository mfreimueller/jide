import type { ScratchResult, ScratchStore } from "./scratch";

export const SCRATCH_NOT_ALLOWED_MESSAGE = "Scratch gibt es in der Prüfung nicht.";

/**
 * What the Scratch IPC channels do. `store()` is undefined in exam mode, where every call is refused.
 * Kept free of Electron so it can be tested directly.
 */
export function scratchHandlers(store: () => ScratchStore | undefined, workspaceRoot: () => string) {
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
    pickAssignment: (id: unknown, path: unknown): Promise<ScratchResult> | { ok: false; message: string } =>
      store()?.pickAssignment(id, path) ?? refuse
  };
}
