import * as monaco from "monaco-editor/editor/editor.api";
// editor.api is the bare core: the suggest widget and snippet insertion are opt-in contributions.
import "monaco-editor/editor/contrib/snippet/browser/snippetController2";
import "monaco-editor/editor/contrib/suggest/browser/suggestController";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import { registerJavaCompletion } from "./completion/provider";
import { registerJava } from "./java-language";

// Only the core editor worker is needed (no TS/JSON/CSS/HTML language services).
self.MonacoEnvironment = {
  getWorker: () => new EditorWorker()
};

export { monaco };

registerJava(monaco);
registerJavaCompletion(monaco);

// Brackets are plain dark text in the design. The editor option `bracketPairColorization` only
// reaches models the editor creates itself; ours are created by the session, so switch it off
// on every model.
monaco.editor.onDidCreateModel((model) =>
  model.updateOptions({ bracketColorizationOptions: { enabled: false, independentColorPoolPerBracketType: false } })
);

/** Code font of the editor; the CSS variable --jide-code-font in app.css has the same stack. */
export const CODE_FONT_FAMILY = '"JetBrains Mono", "Cascadia Mono", Consolas, monospace';

/** Resolves once the bundled JetBrains Mono faces used by the editor are loaded. */
export const codeFontReady: Promise<void> = Promise.all([
  document.fonts.load('400 14px "JetBrains Mono"'),
  document.fonts.load('600 14px "JetBrains Mono"'),
  document.fonts.load('italic 400 14px "JetBrains Mono"')
]).then(
  () => undefined,
  () => undefined // fall back to the next font of the stack, never block the editor
);

// Token names come from Monaco's Java Monarch grammar (see java-language.ts), each with the
// ".java" postfix: keyword.<word> (also primitive types and true/false), number / number.float /
// number.hex / number.octal / number.binary, string / string.escape, comment / comment.doc,
// identifier, type.identifier (added by jide: identifiers starting with an uppercase letter),
// annotation, delimiter.
monaco.editor.defineTheme("jide-light", {
  base: "vs",
  inherit: true,
  rules: [
    { token: "", foreground: "1c2024" },
    { token: "identifier", foreground: "1c2024" },
    { token: "type.identifier", foreground: "0d74ce" },
    { token: "entity.name.function.declaration", foreground: "1c2024", fontStyle: "bold" },
    { token: "keyword", foreground: "8e4ec6" },
    // brackets are "delimiter.curly|parenthesis|square|angle", other delimiters are "delimiter"
    { token: "delimiter", foreground: "1c2024" },
    { token: "string", foreground: "18794e" },
    { token: "number", foreground: "ab6400" },
    { token: "comment", foreground: "80838d", fontStyle: "italic" }
  ],
  colors: {
    "editor.background": "#ffffff",
    "editor.foreground": "#1c2024",
    "editorLineNumber.foreground": "#b0b4ba",
    "editorLineNumber.activeForeground": "#1c2024",
    "editor.lineHighlightBackground": "#f5f8ff",
    "editor.lineHighlightBorder": "#f5f8ff"
  }
});
