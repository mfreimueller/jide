import * as monaco from "monaco-editor/editor/editor.api";
// editor.api is the bare core: the suggest widget, snippet insertion, the read-only message
// (contribution + the MessageController it shows it with, which imports its own CSS), toggle
// comment (Ctrl+/) and word-wise cursor movement (Ctrl/Alt+Left/Right) are opt-in.
import "monaco-editor/editor/contrib/comment/browser/comment";
import "monaco-editor/editor/contrib/message/browser/messageController";
import "monaco-editor/editor/contrib/readOnlyMessage/browser/contribution";
import "monaco-editor/editor/contrib/snippet/browser/snippetController2";
import "monaco-editor/editor/contrib/suggest/browser/suggestController";
import "monaco-editor/editor/contrib/wordOperations/browser/wordOperations";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import { registerJavaCompletion } from "./completion/provider";
import { isDarkScheme, onColorSchemeChange } from "./color-scheme";
import { registerJava } from "./java-language";

// Only the core editor worker is needed (no TS/JSON/CSS/HTML language services).
self.MonacoEnvironment = {
  getWorker: () => new EditorWorker()
};

export { monaco };

registerJava(monaco);
registerJavaCompletion(monaco);

// On a German keyboard "/" is Shift+7, so students press Ctrl+Shift+7 for toggle comment. Monaco keeps
// its own Ctrl+/ (nothing else in Monaco or the app binds Ctrl/Cmd+Shift+7).
monaco.editor.addKeybindingRule({
  keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Digit7,
  command: "editor.action.commentLine",
  when: "editorTextFocus && !editorReadonly"
});

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

// The same design in dark (Figma screens 17-19): the text colours of the light theme mapped to
// their dark counterparts.
monaco.editor.defineTheme("jide-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "", foreground: "edeef0" },
    { token: "identifier", foreground: "edeef0" },
    { token: "type.identifier", foreground: "70b8ff" },
    { token: "entity.name.function.declaration", foreground: "edeef0", fontStyle: "bold" },
    { token: "keyword", foreground: "d19dff" },
    { token: "delimiter", foreground: "edeef0" },
    { token: "string", foreground: "3dd68c" },
    { token: "number", foreground: "ffca16" },
    { token: "comment", foreground: "8b8d98", fontStyle: "italic" }
  ],
  colors: {
    "editor.background": "#18191b",
    "editor.foreground": "#edeef0",
    "editorLineNumber.foreground": "#5b5f66",
    "editorLineNumber.activeForeground": "#edeef0",
    "editor.lineHighlightBackground": "#1f2330",
    "editor.lineHighlightBorder": "#1f2330"
  }
});

/** Name of the Monaco theme for the current colour scheme. */
export function monacoThemeName(): string {
  return isDarkScheme() ? "jide-dark" : "jide-light";
}

// Monaco themes are global: one call restyles every editor.
monaco.editor.setTheme(monacoThemeName());
onColorSchemeChange(() => monaco.editor.setTheme(monacoThemeName()));
