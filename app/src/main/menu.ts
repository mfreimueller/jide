import { app, BrowserWindow, dialog, Menu, type MenuItemConstructorOptions } from "electron";
import { context } from "./context";
import { examMode } from "./exam-state";

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

/** Online mode only: the default menu plus "Abmelden…". Exam and local mode keep Electron's default menu. */
export function installAppMenu(): void {
  if (examMode() || !context().session) return;
  const logoutItem: MenuItemConstructorOptions = { id: "logout", label: "Abmelden…", click: () => void logout() };
  const template: MenuItemConstructorOptions[] =
    process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              logoutItem,
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" }
            ]
          },
          { role: "editMenu" },
          { role: "viewMenu" },
          { role: "windowMenu" }
        ]
      : [
          { label: "Datei", submenu: [logoutItem, { type: "separator" }, { role: "quit" }] },
          { role: "editMenu" },
          { role: "viewMenu" },
          { role: "windowMenu" }
        ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
