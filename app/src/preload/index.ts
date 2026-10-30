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
  onFlushRequest: (handler) => {
    ipcRenderer.on("jide:flush-request", () => {
      void handler()
        .catch(() => undefined)
        .finally(() => ipcRenderer.send("jide:flush-done"));
    });
  }
};

contextBridge.exposeInMainWorld("jide", api);
