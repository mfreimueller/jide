import { contextBridge, ipcRenderer, webFrame } from "electron";
import type { JideApi } from "../shared-types/api";
import { isDetachablePanel, type DetachablePanel } from "../shared-types/panel-windows";

/** Subscribes to a main -> page channel with one payload; returns the unsubscribe function. */
function subscribe<T>(channel: string, handler: (payload: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, payload: T): void => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

/** ?panel=<name> is set by main for the window of a detached panel; anything else is the main window. */
function panelOfThisWindow(): DetachablePanel | undefined {
  const p = new URLSearchParams(location.search).get("panel");
  return isDetachablePanel(p) ? p : undefined;
}

const api: JideApi = {
  panels: {
    window: panelOfThisWindow(),
    enter: (title, id) => ipcRenderer.send("jide:panels-enter", title, id),
    leave: (id) => ipcRenderer.send("jide:panels-leave", id),
    detach: (panel) => ipcRenderer.invoke("jide:panels-detach", panel),
    dock: (panel) => ipcRenderer.send("jide:panels-dock", panel),
    focus: (panel) => ipcRenderer.send("jide:panels-focus", panel),
    focusMain: () => ipcRenderer.send("jide:panels-focus-main"),
    getDetached: () => ipcRenderer.invoke("jide:panels-get"),
    onChange: (handler) => subscribe("jide:panels-changed", handler),
    toOwner: (msg) => ipcRenderer.send("jide:panels-to-owner", msg),
    onFromWindow: (handler) => subscribe("jide:panels-from-window", handler),
    toWindows: (msg) => ipcRenderer.send("jide:panels-to-windows", msg),
    onFromOwner: (handler) => subscribe("jide:panels-from-owner", handler)
  },
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  notifyEditorReady: () => ipcRenderer.send("jide:editor-ready"),
  listExercises: () => ipcRenderer.invoke("jide:list-exercises"),
  listScratch: () => ipcRenderer.invoke("jide:list-scratch"),
  openExercise: (id) => ipcRenderer.invoke("jide:open-exercise", id),
  saveFile: (id, path, content) => ipcRenderer.invoke("jide:save-file", id, path, content),
  resetFile: (id, path) => ipcRenderer.invoke("jide:reset-file", id, path),
  scratchCreate: (title) => ipcRenderer.invoke("jide:scratch-create", title),
  scratchRename: (id, title) => ipcRenderer.invoke("jide:scratch-rename", id, title),
  scratchDelete: (id) => ipcRenderer.invoke("jide:scratch-delete", id),
  scratchAddClass: (id, name) => ipcRenderer.invoke("jide:scratch-add-class", id, name),
  scratchDeleteClass: (id, path) => ipcRenderer.invoke("jide:scratch-delete-class", id, path),
  scratchPickAssignment: (id, path) => ipcRenderer.invoke("jide:scratch-pick-assignment", id, path),
  scratchChooseAssignment: (id) => ipcRenderer.invoke("jide:scratch-choose-assignment", id),
  scratchImport: (kind) => ipcRenderer.invoke("jide:scratch-import", kind),
  scratchCopyExercise: (id, mode) => ipcRenderer.invoke("jide:scratch-copy-exercise", id, mode),
  scratchImportPath: (kind, path) => ipcRenderer.invoke("jide:scratch-import-path", kind, path),
  hiddenGet: () => ipcRenderer.invoke("jide:hidden-get"),
  hiddenSet: (id, mode) => ipcRenderer.invoke("jide:hidden-set", id, mode),
  getSession: () => ipcRenderer.invoke("jide:session"),
  startExam: (name) => ipcRenderer.invoke("jide:exam-start", name),
  getExamName: () => ipcRenderer.invoke("jide:exam-name"),
  examAutosave: (ids) => ipcRenderer.invoke("jide:exam-autosave", ids),
  onSaveStatus: (handler) => {
    const listener = (_e: Electron.IpcRendererEvent, s: Parameters<typeof handler>[0]): void => handler(s);
    ipcRenderer.on("jide:save-status", listener);
    return () => ipcRenderer.removeListener("jide:save-status", listener);
  },
  onCloseConfirm: (handler) => {
    const listener = (): void => handler();
    ipcRenderer.on("jide:confirm-close", listener);
    return () => ipcRenderer.removeListener("jide:confirm-close", listener);
  },
  answerClose: (leave) => ipcRenderer.send("jide:close-answer", leave),
  zoomFactor: () => webFrame.getZoomFactor(),
  zoomStep: (steps) => ipcRenderer.send("jide:zoom-step", steps),
  quit: () => ipcRenderer.send("jide:quit"),
  login: (code) => ipcRenderer.invoke("jide:login", code),
  onSessionExpired: (handler) => {
    const listener = (_e: Electron.IpcRendererEvent, message: string): void => handler(message);
    ipcRenderer.on("jide:session-expired", listener);
    return () => ipcRenderer.removeListener("jide:session-expired", listener);
  },
  onLoggedOut: (handler) => {
    const listener = (): void => handler();
    ipcRenderer.on("jide:logged-out", listener);
    return () => ipcRenderer.removeListener("jide:logged-out", listener);
  },
  handIn: (id, testSummary) => ipcRenderer.invoke("jide:hand-in", id, testSummary),
  compile: (id, files) => ipcRenderer.invoke("jide:compile", id, files),
  run: (id, files) => ipcRenderer.invoke("jide:run", id, files),
  test: (id, files) => ipcRenderer.invoke("jide:test", id, files),
  reportEnv: (exerciseId) => ipcRenderer.invoke("jide:report-env", exerciseId),
  reportSave: (defaultName, text) => ipcRenderer.invoke("jide:report-save", defaultName, text),
  reportCopy: (text) => ipcRenderer.invoke("jide:report-copy", text),
  stopRun: () => ipcRenderer.send("jide:run-stop"),
  sendInput: (text) => ipcRenderer.send("jide:run-input", text),
  onRunEvent: (handler) => {
    const listener = (_e: Electron.IpcRendererEvent, ev: Parameters<typeof handler>[0]): void => handler(ev);
    ipcRenderer.on("jide:run-event", listener);
    return () => ipcRenderer.removeListener("jide:run-event", listener);
  },
  onFlushRequest: (handler) => {
    ipcRenderer.on("jide:flush-request", () => {
      void handler()
        .catch(() => undefined)
        .finally(() => ipcRenderer.send("jide:flush-done"));
    });
  }
};

contextBridge.exposeInMainWorld("jide", api);
