import { ipcMain } from "electron";
import { ApiError, OFFLINE_MESSAGE } from "./api-client";
import { context } from "./context";
import type { AppSession, LoginResult } from "../shared-types/api";

/** Codes are 8 characters, shown as XXXX-XXXX, case-insensitive. */
export function normaliseCode(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function registerOnlineIpc(): void {
  ipcMain.handle("jide:session", (): AppSession => {
    const { session } = context();
    if (!session) return { mode: "local" };
    return { mode: "online", student: session.store.get()?.student ?? null };
  });

  ipcMain.handle("jide:login", async (_e, raw: unknown): Promise<LoginResult> => {
    const { session } = context();
    if (!session) return { ok: false, message: "Die Anmeldung ist hier nicht nötig." };
    const code = typeof raw === "string" ? normaliseCode(raw) : "";
    if (code.length !== 8) return { ok: false, message: "Bitte gib deinen ganzen Code ein (8 Zeichen)." };
    try {
      const student = await session.api.login(code);
      session.store.set({ code, student });
      return { ok: true, student };
    } catch (e) {
      return { ok: false, message: e instanceof ApiError ? e.message : OFFLINE_MESSAGE };
    }
  });
}
