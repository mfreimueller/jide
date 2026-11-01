import { BrowserWindow } from "electron";
import type { SaveStatus } from "../shared-types/api";

/** Tells every window how the last write to the hand-in drive went (the status in the exam bar). */
export function broadcastSaveStatus(status: SaveStatus): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send("jide:save-status", status);
  }
}
