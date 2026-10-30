import * as monaco from "monaco-editor/editor/editor.api";
import "monaco-editor/languages/definitions/java/register";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";

// Only the core editor worker is needed (no TS/JSON/CSS/HTML language services).
self.MonacoEnvironment = {
  getWorker: () => new EditorWorker()
};

export { monaco };
