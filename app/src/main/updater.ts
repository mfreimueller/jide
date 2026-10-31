import { app } from "electron";
import { autoUpdater } from "electron-updater";

/**
 * Silent auto-update (GitHub releases): check at start, download in the background and install when
 * the app quits. No prompts. Packaged app only; errors (e.g. offline) are logged and ignored.
 */
export function startAutoUpdate(): void {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = console;
  autoUpdater.on("error", (err) => console.error("[updater] error:", err?.message ?? err));
  autoUpdater.on("update-available", (info) => console.log("[updater] update available:", info.version));
  autoUpdater.on("update-downloaded", (info) => console.log("[updater] update downloaded:", info.version));
  autoUpdater.checkForUpdates().catch((err: unknown) => console.error("[updater] check failed:", err));
}
