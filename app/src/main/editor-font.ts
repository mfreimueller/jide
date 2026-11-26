import { BrowserWindow, ipcMain } from "electron";
import type { FontAction } from "./menu-template";

export const EDITOR_FONT_DEFAULT = 14;
export const EDITOR_FONT_MIN = 10;
export const EDITOR_FONT_MAX = 28;

/** The editor font size after a menu action: reset = default, in / out = one px, kept within the range. */
export function nextEditorFontSize(current: number, action: FontAction): number {
  if (action === "reset") return EDITOR_FONT_DEFAULT;
  const next = current + (action === "in" ? 1 : -1);
  return Math.min(EDITOR_FONT_MAX, Math.max(EDITOR_FONT_MIN, next));
}

/** Global, in memory only: every start begins at the default. */
let size = EDITOR_FONT_DEFAULT;

/** Ansicht > Editor-Schrift: changes the size and tells every window (also the detached Code window). */
export function changeEditorFont(action: FontAction): void {
  size = nextEditorFontSize(size, action);
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send("jide:editor-font-size", size);
  }
}

/** A window asks for the current size when it starts (windows opened later must not show 14). */
export function registerEditorFontIpc(): void {
  ipcMain.handle("jide:editor-font-size-get", () => size);
}
