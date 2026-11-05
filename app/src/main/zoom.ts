import { ipcMain, type WebContents } from "electron";
import { nextZoomLevel } from "./zoom-level";

/** Ctrl + wheel in the renderer asks for app zoom steps. */
export function registerZoomIpc(): void {
  ipcMain.on("jide:zoom-step", (e, steps: unknown) => {
    if (typeof steps !== "number" || !Number.isFinite(steps)) return;
    const wc = e.sender;
    if (wc.isDestroyed()) return;
    wc.setZoomLevel(nextZoomLevel(wc.getZoomLevel(), Math.round(steps)));
  });
}

/** The zoom is not remembered: every start (and every load of the page) begins at 100 %. */
export function resetZoomOnLoad(wc: WebContents): void {
  wc.on("did-finish-load", () => wc.setZoomLevel(0));
}
