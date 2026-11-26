import { app, BaseWindow, BrowserWindow, dialog, Menu } from "electron";
import { changeEditorFont } from "./editor-font";
import { context } from "./context";
import { examMode } from "./exam-state";
import { buildMenuTemplate } from "./menu-template";
import { chooseTheme, storedTheme } from "./theme";

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

/** Datei > Speichern unter …: tells the focused window's page to save its open project (it does nothing without one). */
function requestSaveProject(from?: BaseWindow): void {
  const win = (from instanceof BrowserWindow ? from : undefined) ?? BrowserWindow.getFocusedWindow();
  if (win && !win.isDestroyed()) win.webContents.send("jide:save-project-request");
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
    exam: !!examMode(),
    onSaveAs: requestSaveProject,
    onEditorFont: changeEditorFont
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
