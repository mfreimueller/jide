import { join } from "node:path";
import { BrowserWindow, type BrowserWindowConstructorOptions } from "electron";
import icon from "../../resources/icon.png?asset";
import { windowBackground } from "./theme";
import { resetZoomOnLoad } from "./zoom";

/**
 * Options of every J;DE window, the main window and the windows of detached panels alike: the same
 * preload and the same security settings (isolated, sandboxed, no Node in the page).
 */
export function baseWindowOptions(title: string): BrowserWindowConstructorOptions {
  return {
    title,
    icon,
    show: false,
    backgroundColor: windowBackground(),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  };
}

/** The page must never navigate away or open windows (e.g. links in the assignment); zoom starts at 100 %. */
export function lockDownWindow(win: BrowserWindow): void {
  win.once("ready-to-show", () => win.show());
  resetZoomOnLoad(win.webContents);
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  // The page sets its own title; the window keeps the one main gave it.
  win.on("page-title-updated", (e) => e.preventDefault());
}

/** Loads the renderer; `panel` selects the panel-only view of a detached window (?panel=...). */
export function loadRenderer(win: BrowserWindow, panel?: string): void {
  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    void win.loadURL(panel ? `${devUrl}?panel=${encodeURIComponent(panel)}` : devUrl);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"), panel ? { query: { panel } } : undefined);
  }
}
