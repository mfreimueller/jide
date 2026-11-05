import { app, BrowserWindow, dialog, Menu } from "electron";
import { context } from "./context";
import { examMode } from "./exam-state";
import { buildMenuTemplate } from "./menu-template";
import { chooseTheme, storedTheme } from "./theme";
import { zoomWindow } from "./zoom";

/** Asks, then deletes the stored code and sends every window back to the login. */
async function logout(): Promise<void> {
  const store = context().session?.store;
  if (!store?.get()) return;
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  const options = {
    type: "question" as const,
    buttons: ["Abmelden", "Abbrechen"],
    defaultId: 1,
    cancelId: 1,
    message: "Wirklich abmelden?",
    detail: "Du brauchst deinen Code, um dich wieder anzumelden."
  };
  const { response } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
  if (response !== 0) return;
  store.clear();
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send("jide:logged-out");
  }
}

/** The application menu of every mode: Electron's default plus Ansicht > Darstellung, and "Abmelden…" online. */
export function installAppMenu(): void {
  const template = buildMenuTemplate({
    platform: process.platform,
    appName: app.name,
    online: !examMode() && !!context().session,
    theme: storedTheme(),
    onTheme: chooseTheme,
    onLogout: () => void logout(),
    onZoom: (action) => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) zoomWindow(win.webContents, action);
    }
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
