import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { ApiClient, SESSION_EXPIRED_MESSAGE } from "./api-client";
import { HandInLog } from "./handin-log";
import { OnlineSource } from "./online-source";
import { examMode } from "./exam-state";
import { PackageCache } from "./package-cache";
import { SessionStore } from "./session-store";
import { LocalSource, type ExerciseSource } from "./source";

// Set by electron-vite `define` (see electron.vite.config.ts).
declare const __JIDE_API_URL__: string | undefined;

const DEFAULT_API_URL = "http://localhost:3000";

/**
 * API base URL: fixed at build time. Only an unpackaged app (dev, e2e) may override it at runtime,
 * so an installed app can never be redirected through its environment.
 */
export function apiUrl(): string {
  const override = process.env["JIDE_API_URL"];
  if (!app.isPackaged && override) return override;
  return (typeof __JIDE_API_URL__ === "string" && __JIDE_API_URL__) || DEFAULT_API_URL;
}

export interface MainContext {
  source: ExerciseSource;
  handIns: HandInLog;
  /** Online mode only. */
  session?: { store: SessionStore; api: ApiClient };
}

let ctx: MainContext | undefined;

/**
 * Chooses the exercise source: `exercises/` of the exam folder in exam mode, a local folder if
 * JIDE_EXERCISES_DIR is set, otherwise the backend.
 */
export function context(): MainContext {
  if (ctx) return ctx;
  const userData = app.getPath("userData");
  const handIns = new HandInLog(join(userData, "handins.json"));
  const exam = examMode();
  const dir = exam ? exam.exercisesDir : process.env["JIDE_EXERCISES_DIR"];
  if (dir) {
    ctx = { source: new LocalSource(dir), handIns };
    return ctx;
  }
  const store = new SessionStore(join(userData, "session.json"));
  const api = new ApiClient({
    baseUrl: apiUrl(),
    getCode: () => store.get()?.code,
    onUnauthorized: () => {
      store.clear();
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.webContents.send("jide:session-expired", SESSION_EXPIRED_MESSAGE);
      }
    }
  });
  ctx = { source: new OnlineSource(api, new PackageCache(join(userData, "cache"))), handIns, session: { store, api } };
  return ctx;
}
