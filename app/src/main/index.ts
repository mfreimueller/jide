import { join } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import icon from "../../resources/icon.png?asset";
import { registerCompileIpc } from "./compile";
import { registerExerciseIpc } from "./exercises";
import { registerRunIpc } from "./run";

const smoke = process.env.JIDE_SMOKE === "1";

// Tests (and only tests) point the user data folder to a temp dir.
if (process.env["JIDE_USER_DATA_DIR"]) {
  app.setPath("userData", process.env["JIDE_USER_DATA_DIR"]);
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
    title: "J;DE",
    icon,
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
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
    const finish = (): void => {
      clearTimeout(timer);
      ipcMain.removeListener("jide:flush-done", onDone);
      mayClose = true;
      win.close();
    };
    const onDone = (ev: Electron.IpcMainEvent): void => {
      if (ev.sender === win.webContents) finish();
    };
    const timer = setTimeout(finish, FLUSH_TIMEOUT_MS);
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

app.whenReady().then(() => {
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
  registerExerciseIpc();
  registerCompileIpc();
  registerRunIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
