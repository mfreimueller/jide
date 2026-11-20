import { BrowserWindow, dialog, ipcMain } from "electron";
import { context } from "./context";
import { findExercise, workspaceRoot } from "./exercises";
import { scratchHandlers } from "./scratch-handlers";

/** Scratch operations for the renderer. Not available in exam mode (the context has no Scratch there). */
export function registerScratchIpc(): void {
  const h = scratchHandlers(() => context().scratch, workspaceRoot, findExercise, async (id) => (await context().source.gradedView?.(id)) ?? null);
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
  ipcMain.handle("jide:scratch-import", (e, kind: unknown) =>
    h.importExercise(kind, async (k) => {
      const win = BrowserWindow.fromWebContents(e.sender);
      const options: Electron.OpenDialogOptions =
        k === "folder"
          ? { title: "Aufgabenordner wählen", properties: ["openDirectory"] }
          : { title: "ZIP-Datei wählen", properties: ["openFile"], filters: [{ name: "ZIP-Datei (.zip)", extensions: ["zip"] }] };
      const r = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
      return r.canceled ? undefined : r.filePaths[0];
    })
  );
  ipcMain.handle("jide:scratch-import-path", (_e, kind: unknown, path: unknown) => h.importPath(kind, path));
  ipcMain.handle("jide:scratch-copy-exercise", (_e, id: unknown, mode: unknown) => h.copyExercise(id, mode));
  // Hiding exercises (T54): choices per account, only on this laptop; refused in exam mode.
  ipcMain.handle("jide:hidden-get", () => context().hidden?.get() ?? {});
  ipcMain.handle("jide:hidden-set", (_e, id: unknown, mode: unknown) => context().hidden?.set(id, mode) ?? {});
  ipcMain.handle("jide:scratch-pick-assignment", (_e, id: unknown, path: unknown) => h.pickAssignment(id, path));
}
