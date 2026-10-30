import { join } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";

const smoke = process.env.JIDE_SMOKE === "1";

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    title: "jide",
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
  // The page sets its own title; keep "jide".
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
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
