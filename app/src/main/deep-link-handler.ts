import { app, BrowserWindow, ipcMain } from "electron";
import type { AppNotice } from "../shared-types/api";
import { isAllowedPracticeSrc, MSG_BAD_ORIGIN, MSG_EXAM_MODE, parseDeepLink } from "./deep-link";
import { context } from "./context";
import { examMode } from "./exam-state";
import { importPractice, MSG_LOADING, MSG_OFFLINE } from "./practice-import";

let mainWindow: BrowserWindow | undefined;
// Creates the main window when a link arrives while none is open (macOS keeps running without windows).
let openMainWindow: (() => void) | undefined;
// The renderer subscribes to notices once its App is mounted ("jide:app-ready"); links wait until then.
let rendererReady = false;
const pending: string[] = [];

/** Shows a short message in the page (the App toast), never a native dialog. */
export function pushNotice(win: BrowserWindow, notice: AppNotice): void {
  if (!win.isDestroyed()) win.webContents.send("jide:notice", notice);
}

// Links are handled one after another, never in parallel.
let chain: Promise<void> = Promise.resolve();

async function runPracticeLink(src: string, win: BrowserWindow): Promise<void> {
  const out = await importPractice(src, context().scratch, () => pushNotice(win, { kind: "info", text: MSG_LOADING }));
  if (win.isDestroyed()) return;
  if (out.kind === "error") pushNotice(win, { kind: "error", text: out.message });
  else win.webContents.send("jide:open-exercise", out.id);
}

/**
 * Practice link with a checked origin: opens the existing Scratch copy of this source, else downloads and
 * imports it; the renderer then opens the exercise ("jide:open-exercise").
 */
export function handlePracticeLink(src: string, win: BrowserWindow): Promise<void> {
  chain = chain.then(() => runPracticeLink(src, win)).catch(() => {
    if (!win.isDestroyed()) pushNotice(win, { kind: "error", text: MSG_OFFLINE });
  });
  return chain;
}

/** Parses and checks one link, then dispatches it. Exam mode ignores every link. */
export function dispatchDeepLink(raw: string, win: BrowserWindow): void {
  if (examMode()) {
    pushNotice(win, { kind: "info", text: MSG_EXAM_MODE });
    return;
  }
  const link = parseDeepLink(raw);
  if (link.kind === "error") {
    pushNotice(win, { kind: "error", text: link.message });
    return;
  }
  if (!isAllowedPracticeSrc(link.src)) {
    pushNotice(win, { kind: "error", text: MSG_BAD_ORIGIN });
    return;
  }
  handlePracticeLink(link.src, win);
}

/** Brings the main window to the front (restores it when minimized). */
export function focusMainWindow(): void {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

/** A link arrived (start argv, `second-instance`, `open-url`): handled now, or queued until the page is ready. */
export function receiveDeepLink(raw: string): void {
  if ((!mainWindow || mainWindow.isDestroyed()) && openMainWindow && app.isReady()) openMainWindow();
  focusMainWindow();
  if (mainWindow && !mainWindow.isDestroyed() && rendererReady) dispatchDeepLink(raw, mainWindow);
  else pending.push(raw);
}

/** How to open a new main window; set once the app is ready. */
export function setMainWindowOpener(open: () => void): void {
  openMainWindow = open;
}

/** The main window was created; its page signals readiness with "jide:app-ready". */
export function attachMainWindow(win: BrowserWindow): void {
  mainWindow = win;
  rendererReady = false;
  const contents = win.webContents;
  const onReady = (e: Electron.IpcMainEvent): void => {
    if (e.sender !== contents || win.isDestroyed()) return;
    rendererReady = true;
    for (const raw of pending.splice(0)) dispatchDeepLink(raw, win);
  };
  ipcMain.on("jide:app-ready", onReady);
  win.on("closed", () => {
    ipcMain.removeListener("jide:app-ready", onReady);
    if (mainWindow === win) mainWindow = undefined;
  });
}

/** Top level, before `ready`: macOS delivers links through `open-url`, also while the app is starting. */
export function listenForOpenUrl(): void {
  app.on("open-url", (event, url) => {
    event.preventDefault();
    receiveDeepLink(url);
  });
}
