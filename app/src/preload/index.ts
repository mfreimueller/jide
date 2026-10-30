import { contextBridge, ipcRenderer } from "electron";
import type { JideApi } from "../shared-types/api";

const api: JideApi = {
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  notifyEditorReady: () => ipcRenderer.send("jide:editor-ready")
};

contextBridge.exposeInMainWorld("jide", api);
