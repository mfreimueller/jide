import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import { registerBugReportIpc } from "./bug-report";
import { registerCompileIpc } from "./compile";
import { askToClose, examCloseNeedsConfirm, registerExamSaveIpc } from "./exam-session";
import { examMode, initExam, redirectPathsForExamMode, registerExamIpc } from "./exam-state";
import { findDeepLinkInArgv } from "./deep-link";
import { attachMainWindow, focusMainWindow, listenForOpenUrl, receiveDeepLink, setMainWindowOpener } from "./deep-link-handler";
import { registerExerciseIpc } from "./exercises";
import { registerScratchIpc } from "./scratch-ipc";
import { registerLinuxDeepLink, runCommand } from "./linux-deep-link";
import { installAppMenu } from "./menu";
import { registerOnlineIpc } from "./online";
import { registerRunIpc } from "./run";
import { registerTestIpc } from "./test";
import { closeAllPanelWindows, registerPanelWindowIpc } from "./panel-windows";
import { applyTheme, storedTheme, watchWindowBackground } from "./theme";
import { startAutoUpdate } from "./updater";
import { baseWindowOptions, loadRenderer, lockDownWindow } from "./window";
import { registerZoomIpc } from "./zoom";

const smoke = process.env.JIDE_SMOKE === "1";

// Tests (and only tests) point the user data folder to a temp dir.
if (process.env["JIDE_USER_DATA_DIR"]) {
  app.setPath("userData", process.env["JIDE_USER_DATA_DIR"]);
}
// Exam mode runs from a read-only share: nothing may be written next to the exe. Before app ready.
redirectPathsForExamMode();

// One J;DE per user data folder (so parallel test instances with their own folders keep working). Must
// come after the userData redirects above: the lock lives in that folder.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  // A second start (e.g. a jide:// link clicked while J;DE runs) forwards its argv here.
  app.on("second-instance", (_e, argv) => {
    const link = findDeepLinkInArgv(argv);
    if (link) receiveDeepLink(link);
    else focusMainWindow();
  });
  listenForOpenUrl(); // macOS; before ready
  const startLink = findDeepLinkInArgv(process.argv); // Windows / Linux; also in dev
  if (startLink) receiveDeepLink(startLink);
}

/** Make J;DE the handler of jide:// links; never in tests, smoke runs or exam mode (no system changes there). */
function registerProtocolClient(): void {
  if (process.env["JIDE_USER_DATA_DIR"] || smoke || examMode()) return;
  if (process.platform === "linux" && process.env["APPIMAGE"]) {
    // AppImage: no installer writes a desktop entry, so we keep our own (see linux-deep-link.ts). Electron's
    // setAsDefaultProtocolClient is not called here: its documentation only describes Windows and macOS.
    void registerLinuxDeepLink({
      appImage: process.env["APPIMAGE"],
      home: homedir(),
      iconSource: join(process.resourcesPath, "icon.png"),
      run: runCommand,
      log: (line) => console.log(`[deep-link] ${line}`)
    });
    return;
  }
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient("jide", process.execPath, [resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient("jide");
  }
}

const FLUSH_TIMEOUT_MS = 5000;

// Cmd+Q / app.quit() closes the windows first. We cancel that close once to let the renderer
// save, so the quit has to be repeated afterwards.
let quitRequested = false;
app.on("before-quit", () => {
  quitRequested = true;
});

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    ...baseWindowOptions(examMode() ? "J;DE – Prüfungsmodus" : "J;DE"),
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700
  });
  lockDownWindow(win);
  const contents = win.webContents; // the window's own property cannot be read once it is closed

  // Closing handshake: let the renderer save pending edits first.
  let flushing = false;
  let mayClose = false;
  win.on("closed", () => {
    closeAllPanelWindows(contents);
    if (quitRequested) app.quit();
  });
  win.on("close", (e) => {
    if (mayClose) return;
    e.preventDefault();
    if (flushing || win.webContents.isDestroyed() || win.webContents.isCrashed()) {
      if (!flushing) {
        mayClose = true;
        win.close();
      }
      return;
    }
    flushing = true;
    const finish = async (): Promise<void> => {
      clearTimeout(timer);
      ipcMain.removeListener("jide:flush-done", onDone);
      // Exam mode: save a copy to the hand-in drive and ask if the last changes were not handed in.
      let leave = true;
      if (examMode()?.config) {
        try {
          if (await examCloseNeedsConfirm()) leave = await askToClose(win);
        } catch {
          leave = true;
        }
      }
      if (win.isDestroyed()) return;
      if (!leave) {
        flushing = false; // "Weiterarbeiten"
        return;
      }
      mayClose = true;
      win.close();
    };
    const onDone = (ev: Electron.IpcMainEvent): void => {
      if (ev.sender === win.webContents) void finish();
    };
    const timer = setTimeout(() => void finish(), FLUSH_TIMEOUT_MS);
    ipcMain.on("jide:flush-done", onDone);
    win.webContents.send("jide:flush-request");
  });
  attachMainWindow(win);
  loadRenderer(win);
  return win;
}

app.whenReady().then(async () => {
  if (!gotLock) return; // quitting: another instance owns this user data folder
  // Before any window: the remembered Hell / Dunkel / System choice (default System).
  applyTheme(storedTheme());
  watchWindowBackground();
  // Exam mode: exam.json is checked and the JDK is looked up before the helper can start.
  await initExam();
  registerProtocolClient();
  installAppMenu();
  if (smoke) {
    const timer = setTimeout(() => {
      console.error("JIDE_SMOKE_TIMEOUT");
      app.exit(1);
    }, 20_000);
    ipcMain.once("jide:editor-ready", () => {
      clearTimeout(timer);
      process.stdout.write("JIDE_SMOKE_READY\n", () => app.exit(0));
    });
  }
  ipcMain.on("jide:quit", () => app.quit());
  registerExamIpc();
  registerExamSaveIpc();
  registerOnlineIpc();
  registerBugReportIpc();
  registerExerciseIpc();
  registerScratchIpc();
  registerCompileIpc();
  registerRunIpc();
  registerTestIpc();
  registerZoomIpc();
  registerPanelWindowIpc();
  createWindow();
  setMainWindowOpener(() => createWindow());
  if (!smoke && !examMode()) startAutoUpdate();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
