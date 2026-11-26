import type { WebContents } from "electron";

/** The app has no window zoom: every load of the page starts at 100 % (also after an earlier setZoomLevel). */
export function resetZoomOnLoad(wc: WebContents): void {
  wc.on("did-finish-load", () => wc.setZoomLevel(0));
}
