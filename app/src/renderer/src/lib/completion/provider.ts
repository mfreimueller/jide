import type * as Monaco from "monaco-editor/editor/editor.api";
import { getCompletions, type Suggestion, type SuggestionKind } from "./suggest";

function kindOf(m: typeof Monaco, kind: SuggestionKind): Monaco.languages.CompletionItemKind {
  const k = m.languages.CompletionItemKind;
  switch (kind) {
    case "method":
      return k.Method;
    case "field":
      return k.Field;
    case "constant":
      return k.Constant;
    case "constructor":
      return k.Constructor;
    case "class":
      return k.Class;
    case "variable":
      return k.Variable;
    case "keyword":
      return k.Keyword;
    case "snippet":
      return k.Snippet;
  }
}

function documentation(s: Suggestion): Monaco.IMarkdownString {
  const signature = s.signature ? `\`${s.signature.replace(/`/g, "'")}\`\n\n` : "";
  const example = s.example ? `\n\n**Beispiel:** \`${s.example.replace(/`/g, "'")}\`` : "";
  return { value: signature + s.doc + example };
}

/** Registers the completion provider for Java (trigger character "."). */
export function registerJavaCompletion(m: typeof Monaco): Monaco.IDisposable {
  return m.languages.registerCompletionItemProvider("java", {
    triggerCharacters: ["."],
    provideCompletionItems(model, position) {
      const offset = model.getOffsetAt(position);
      const { prefixLength, items } = getCompletions(model.getValue(), offset);
      const range = new m.Range(position.lineNumber, position.column - prefixLength, position.lineNumber, position.column);
      return {
        suggestions: items.map((s) => ({
          label: { label: s.label, detail: s.detail ? ` ${s.detail}` : undefined },
          kind: kindOf(m, s.kind),
          insertText: s.insert,
          insertTextRules: s.snippet ? m.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
          detail: s.snippet && s.kind === "snippet" ? s.detail : undefined,
          documentation: documentation(s),
          sortText: s.sort,
          filterText: s.label,
          range
        }))
      };
    }
  });
}
