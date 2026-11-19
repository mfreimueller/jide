import { release } from "node:os";
import { writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { app, BrowserWindow, clipboard, dialog, ipcMain } from "electron";
import type { ReportEnv, ReportSaveResult } from "../shared-types/api";
import { context } from "./context";
import { examSession } from "./exam-state";
import { PackageCache } from "./package-cache";

/** "Windows 11 (10.0.22631)": Windows 11 is NT 10.0 from build 22000 on. Other systems: name and kernel release. */
export function describeOs(platform: string, rel: string): string {
  if (platform === "win32") {
    const build = Number(rel.split(".")[2]);
    return `${Number.isFinite(build) && build >= 22000 ? "Windows 11" : "Windows 10"} (${rel})`;
  }
  const name = platform === "darwin" ? "macOS (Darwin)" : platform === "linux" ? "Linux" : platform;
  return `${name} ${rel}`;
}

/** Safe default name for the save dialog: a plain `.txt` file name. */
export function reportFileName(raw: unknown): string {
  const base = typeof raw === "string" ? basename(raw.replace(/\\/g, "/")).replace(/[^\w.-]/g, "_") : "";
  const name = base || "jde-fehlerbericht";
  return name.toLowerCase().endsWith(".txt") ? name : `${name}.txt`;
}

/** Bug report (T44): environment facts, save dialog, clipboard. */
export function registerBugReportIpc(): void {
  ipcMain.handle("jide:report-env", async (_e, exerciseId: unknown): Promise<ReportEnv> => {
    const mode = examSession() ? "exam" : context().session ? "online" : "local";
    let packageVersion: string | null = null;
    if (mode === "online" && typeof exerciseId === "string") {
      const v = await new PackageCache(join(app.getPath("userData"), "cache")).version(exerciseId);
      packageVersion = v ? v.replace(/[^0-9a-f]/gi, "").slice(0, 8) || null : null;
    }
    return { appVersion: app.getVersion(), os: describeOs(process.platform, release()), mode, packageVersion };
  });

  ipcMain.handle("jide:report-save", async (e, defaultName: unknown, text: unknown): Promise<ReportSaveResult> => {
    if (typeof text !== "string") return { ok: false, canceled: false };
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
    const options = {
      defaultPath: join(app.getPath("documents"), reportFileName(defaultName)),
      filters: [{ name: "Textdatei", extensions: ["txt"] }]
    };
    const r = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    if (r.canceled || !r.filePath) return { ok: false, canceled: true };
    try {
      await writeFile(r.filePath, text, "utf8");
      return { ok: true };
    } catch {
      return { ok: false, canceled: false };
    }
  });

  ipcMain.handle("jide:report-copy", (_e, text: unknown): void => {
    if (typeof text === "string") clipboard.writeText(text);
  });
}
