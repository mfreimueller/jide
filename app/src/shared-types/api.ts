export interface JideApi {
  versions: { electron: string; chrome: string; node: string };
  /** Tells the main process that the editor has been created (used by the smoke test). */
  notifyEditorReady: () => void;
}
