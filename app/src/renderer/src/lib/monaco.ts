import * as monaco from "monaco-editor/editor/editor.api";
import "monaco-editor/languages/definitions/java/register";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";

// Only the core editor worker is needed (no TS/JSON/CSS/HTML language services).
self.MonacoEnvironment = {
  getWorker: () => new EditorWorker()
};

export { monaco };

// Token names come from Monaco's Java Monarch grammar (languages/definitions/java/java.js),
// each with the ".java" postfix: keyword.<word> (also primitive types and true/false),
// number / number.float / number.hex / number.octal / number.binary, string / string.escape,
// comment / comment.doc, identifier, annotation, delimiter.
// The grammar has no separate token for type names, so "types" cannot be coloured yet.
monaco.editor.defineTheme("jide-light", {
  base: "vs",
  inherit: true,
  rules: [
    { token: "keyword", foreground: "8e4ec6" },
    // brackets are "delimiter.curly|parenthesis|square|angle", other delimiters are "delimiter"
    { token: "delimiter", foreground: "1c2024" },
    { token: "string", foreground: "18794e" },
    { token: "number", foreground: "ab6400" },
    { token: "comment", foreground: "80838d", fontStyle: "italic" }
  ],
  colors: {
    "editor.lineHighlightBackground": "#f5f8ff",
    "editor.lineHighlightBorder": "#f5f8ff"
  }
});
