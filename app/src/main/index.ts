import { join } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import icon from "../../resources/icon.png?asset";
import { registerCompileIpc } from "./compile";
import { askToClose, examCloseNeedsConfirm, registerExamSaveIpc } from "./exam-session";
import { examMode, initExam, redirectPathsForExamMode, registerExamIpc } from "./exam-state";
import { registerExerciseIpc } from "./exercises";
import { installAppMenu } from "./menu";
import { registerOnlineIpc } from "./online";
import { registerRunIpc } from "./run";
import { registerTestIpc } from "./test";
import { applyTheme, storedTheme, watchWindowBackground, windowBackground } from "./theme";
import { startAutoUpdate } from "./updater";

const smoke = process.env.JIDE_SMOKE === "1";

// Tests (and only tests) point the user data folder to a temp dir.
if (process.env["JIDE_USER_DATA_DIR"]) {
  app.setPath("userData", process.env["JIDE_USER_DATA_DIR"]);
}
// Exam mode runs from a read-only share: nothing may be written next to the exe. Before app ready.
redirectPathsForExamMode();

const FLUSH_TIMEOUT_MS = 5000;

// Cmd+Q / app.quit() closes the windows first. We cancel that close once to let the renderer
// save, so the quit has to be repeated afterwards.
let quitRequested = false;
app.on("before-quit", () => {
  quitRequested = true;
});

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    title: examMode() ? "J;DE – Prüfungsmodus" : "J;DE",
    icon,
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: windowBackground(),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.once("ready-to-show", () => win.show());

  // The renderer must never navigate away or open windows (e.g. links in the assignment).
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());

  // Closing handshake: let the renderer save pending edits first.
  let flushing = false;
  let mayClose = false;
  win.on("closed", () => {
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
  // The page sets its own title; keep "J;DE".
  win.on("page-title-updated", (e) => e.preventDefault());

  if (process.env["ELECTRON_RENDERER_URL"]) {
    void win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }
  return win;
}

app.whenReady().then(async () => {
  // Before any window: the remembered Hell / Dunkel / System choice (default System).
  applyTheme(storedTheme());
  watchWindowBackground();
  // Exam mode: exam.json is checked and the JDK is looked up before the helper can start.
  await initExam();
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
  registerExerciseIpc();
  registerCompileIpc();
  registerRunIpc();
  registerTestIpc();
  createWindow();
  if (!smoke && !examMode()) startAutoUpdate();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
