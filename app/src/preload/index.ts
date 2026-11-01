import { contextBridge, ipcRenderer } from "electron";
import type { JideApi } from "../shared-types/api";

const api: JideApi = {
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  notifyEditorReady: () => ipcRenderer.send("jide:editor-ready"),
  listExercises: () => ipcRenderer.invoke("jide:list-exercises"),
  openExercise: (id) => ipcRenderer.invoke("jide:open-exercise", id),
  saveFile: (id, path, content) => ipcRenderer.invoke("jide:save-file", id, path, content),
  resetFile: (id, path) => ipcRenderer.invoke("jide:reset-file", id, path),
  getSession: () => ipcRenderer.invoke("jide:session"),
  quit: () => ipcRenderer.send("jide:quit"),
  login: (code) => ipcRenderer.invoke("jide:login", code),
  onSessionExpired: (handler) => {
    const listener = (_e: Electron.IpcRendererEvent, message: string): void => handler(message);
    ipcRenderer.on("jide:session-expired", listener);
    return () => ipcRenderer.removeListener("jide:session-expired", listener);
  },
  handIn: (id, testSummary) => ipcRenderer.invoke("jide:hand-in", id, testSummary),
  compile: (id, files) => ipcRenderer.invoke("jide:compile", id, files),
  run: (id, files) => ipcRenderer.invoke("jide:run", id, files),
  test: (id, files) => ipcRenderer.invoke("jide:test", id, files),
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
