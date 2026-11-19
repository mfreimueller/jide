import { BrowserWindow, dialog, ipcMain } from "electron";
import { context } from "./context";
import { workspaceRoot } from "./exercises";
import { scratchHandlers } from "./scratch-handlers";

/** Scratch operations for the renderer. Not available in exam mode (the context has no Scratch there). */
export function registerScratchIpc(): void {
  const h = scratchHandlers(() => context().scratch, workspaceRoot);
  ipcMain.handle("jide:scratch-create", (_e, title: unknown) => h.create(title));
  ipcMain.handle("jide:scratch-rename", (_e, id: unknown, title: unknown) => h.rename(id, title));
  ipcMain.handle("jide:scratch-delete", (_e, id: unknown) => h.delete(id));
  ipcMain.handle("jide:scratch-add-class", (_e, id: unknown, name: unknown) => h.addClass(id, name));
  ipcMain.handle("jide:scratch-delete-class", (_e, id: unknown, path: unknown) => h.deleteClass(id, path));
  ipcMain.handle("jide:scratch-choose-assignment", (e, id: unknown) =>
    h.chooseAssignment(id, async () => {
      const win = BrowserWindow.fromWebContents(e.sender);
      const options: Electron.OpenDialogOptions = {
        title: "Angabe wählen",
        properties: ["openFile"],
        filters: [{ name: "Markdown (.md)", extensions: ["md"] }]
      };
      const r = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
      return r.canceled ? undefined : r.filePaths[0];
    })
  );
  ipcMain.handle("jide:scratch-pick-assignment", (_e, id: unknown, path: unknown) => h.pickAssignment(id, path));
}
