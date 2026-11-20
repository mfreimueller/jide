import { BrowserWindow, ipcMain, screen, type WebContents } from "electron";
import {
  detach,
  dock,
  isDetachablePanel,
  MIN_WINDOW_SIZE,
  placeWindow,
  windowTitle,
  type DetachablePanel,
  type Rect
} from "../shared-types/panel-windows";
import { examMode } from "./exam-state";
import { baseWindowOptions, loadRenderer, lockDownWindow } from "./window";

/**
 * Windows of detached panels (M10). The main window renderer owns all exercise state; the windows here
 * are views. Main owns only the window lifecycle: one window per detached panel, bound to the open
 * exercise, and relays messages between the owner and the panel windows.
 */

let owner: WebContents | undefined;
let exerciseTitle = "";
let entryId = 0;
let detached: DetachablePanel[] = [];
const windows = new Map<DetachablePanel, BrowserWindow>();
/** Within a session a window reopens where it was (not remembered across restarts). */
const savedBounds = new Map<DetachablePanel, Rect>();
let stopWatchingOwner: (() => void) | undefined;

function ownerAlive(): boolean {
  return owner !== undefined && !owner.isDestroyed();
}

function broadcastDetached(): void {
  const targets = [...(ownerAlive() ? [owner!] : []), ...[...windows.values()].map((w) => w.webContents)];
  for (const wc of targets) if (!wc.isDestroyed()) wc.send("jide:panels-changed", detached);
}

function sendToPanelWindows(channel: string, msg: unknown): void {
  for (const w of windows.values()) if (!w.isDestroyed()) w.webContents.send(channel, msg);
}

function isPanelWindowSender(wc: WebContents): boolean {
  return [...windows.values()].some((w) => !w.isDestroyed() && w.webContents === wc);
}

function openWindow(panel: DetachablePanel): boolean {
  const existing = windows.get(panel);
  if (existing && !existing.isDestroyed()) {
    focusWindow(panel);
    return true;
  }
  const mainWin = ownerAlive() ? BrowserWindow.fromWebContents(owner!) : null;
  if (!mainWin) return false;
  const displays = screen.getAllDisplays().map((d) => ({ id: d.id, workArea: d.workArea }));
  const bounds = placeWindow({ panel, saved: savedBounds.get(panel), main: mainWin.getBounds(), displays });
  const win = new BrowserWindow({
    ...baseWindowOptions(windowTitle(panel, exerciseTitle)),
    ...bounds,
    minWidth: MIN_WINDOW_SIZE.width,
    minHeight: MIN_WINDOW_SIZE.height
  });
  lockDownWindow(win);
  windows.set(panel, win);
  detached = detach(detached, panel);
  win.on("closed", () => {
    // Closing the window (button or OS) docks the panel again.
    if (windows.get(panel) === win) {
      windows.delete(panel);
      detached = dock(detached, panel);
      broadcastDetached();
    }
  });
  win.on("close", () => {
    if (!win.isDestroyed()) savedBounds.set(panel, win.getBounds());
  });
  loadRenderer(win, panel);
  broadcastDetached();
  return true;
}

function focusWindow(panel: DetachablePanel): void {
  const win = windows.get(panel);
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

/** Closes the windows of all detached panels (leaving the exercise, closing the main window). */
export function closeAllPanelWindows(by?: WebContents): void {
  if (by && by !== owner) return;
  for (const [panel, win] of [...windows]) {
    windows.delete(panel);
    if (!win.isDestroyed()) {
      savedBounds.set(panel, win.getBounds());
      win.destroy(); // no close handshake: the panels hold no state of their own
    }
  }
  const changed = detached.length > 0;
  detached = [];
  if (changed) broadcastDetached();
}

function leave(): void {
  closeAllPanelWindows();
  stopWatchingOwner?.();
  stopWatchingOwner = undefined;
  owner = undefined;
  exerciseTitle = "";
}

export function registerPanelWindowIpc(): void {
  ipcMain.on("jide:panels-enter", (e, title: unknown, id: unknown) => {
    if (examMode() || isPanelWindowSender(e.sender)) return;
    leave(); // another exercise: the windows of the previous one are gone
    owner = e.sender;
    exerciseTitle = typeof title === "string" ? title : "";
    entryId = typeof id === "number" ? id : 0;
    // Reloading the main window (View > Reload) ends the exercise as well.
    const wc = e.sender;
    const onNavigate = (details: Electron.Event<Electron.WebContentsDidStartNavigationEventParams>): void => {
      if (details.isMainFrame && !details.isSameDocument) leave();
    };
    wc.on("did-start-navigation", onNavigate);
    stopWatchingOwner = () => wc.removeListener("did-start-navigation", onNavigate);
    wc.once("destroyed", () => {
      if (owner === wc) leave();
    });
  });

  ipcMain.on("jide:panels-leave", (e, id: unknown) => {
    // Only the workspace that entered may leave (a newer one has entered by then otherwise).
    if (e.sender === owner && id === entryId) leave();
  });

  ipcMain.handle("jide:panels-detach", (e, panel: unknown): boolean => {
    if (examMode() || e.sender !== owner || !isDetachablePanel(panel)) return false;
    return openWindow(panel);
  });

  ipcMain.on("jide:panels-dock", (e, panel: unknown) => {
    if (!isDetachablePanel(panel)) return;
    const win = windows.get(panel);
    // The owner docks any panel; a panel window only itself.
    if (!win || win.isDestroyed()) return;
    if (e.sender === owner || e.sender === win.webContents) win.close();
  });

  ipcMain.on("jide:panels-focus", (e, panel: unknown) => {
    if (e.sender === owner && isDetachablePanel(panel)) focusWindow(panel);
  });

  ipcMain.on("jide:panels-focus-main", (e) => {
    if (!isPanelWindowSender(e.sender) || !ownerAlive()) return;
    const win = BrowserWindow.fromWebContents(owner!);
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  ipcMain.handle("jide:panels-get", (): DetachablePanel[] => detached);

  ipcMain.on("jide:panels-to-owner", (e, msg: unknown) => {
    if (!isPanelWindowSender(e.sender) || !ownerAlive()) return;
    owner!.send("jide:panels-from-window", msg);
  });

  ipcMain.on("jide:panels-to-windows", (e, msg: unknown) => {
    if (e.sender !== owner) return;
    sendToPanelWindows("jide:panels-from-owner", msg);
  });
}
