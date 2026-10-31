import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { autoUpdater } from "electron-updater";

/** Updater events go to <userData>/updater.log (the update-test workflow reads it) and the console. */
function log(line: string): void {
  console.log(`[updater] ${line}`);
  try {
    appendFileSync(join(app.getPath("userData"), "updater.log"), `${new Date().toISOString()} ${line}\n`);
  } catch {
    // logging must never break the app
  }
}

/**
 * Silent auto-update (GitHub releases): check at start, download in the background and install when
 * the app quits. No prompts. Packaged app only; errors (e.g. offline) are logged and ignored.
 */
export function startAutoUpdate(): void {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("error", (err) => log(`error: ${err?.message ?? err}`));
  autoUpdater.on("update-available", (info) => log(`update available: ${info.version}`));
  autoUpdater.on("update-not-available", (info) => log(`no update: ${info.version}`));
  autoUpdater.on("update-downloaded", (info) => log(`update downloaded: ${info.version}`));
  autoUpdater.checkForUpdates().catch((err: unknown) => log(`check failed: ${String(err)}`));
}
