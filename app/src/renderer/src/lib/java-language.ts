import type * as Monaco from "monaco-editor/editor/editor.api";
import { conf, language } from "monaco-editor/languages/definitions/java/java";

/** Token for identifiers that start with an uppercase letter ("types", see SPEC 3.1). */
export const TYPE_TOKEN = "type.identifier";

/** Token for the name in a method declaration (`maximum` in `int maximum(int a, int b) {`). */
export const METHOD_DECLARATION_TOKEN = "entity.name.function.declaration";

const NAME = "[a-zA-Z_$][\\w$]*";
const PRIMITIVE = "(?:void|boolean|byte|short|int|long|char|float|double)";
// generic arguments (one level of nesting), array brackets, whitespace, method name and "("
const DECLARATION_TAIL =
  "(?:<[^<>()]*(?:<[^<>()]*>[^<>()]*)*>)?(?:\\s*\\[\\s*\\])*\\s+" + NAME + "\\s*\\(";

/**
 * Monaco's Java Monarch grammar with extra rules (the original has no type tokens): identifiers
 * starting with an uppercase letter get `type.identifier`, and the name in a method declaration
 * (return type, name, "(") gets `entity.name.function.declaration`. Java keywords are all
 * lowercase, so the new rules are simply put in front of the identifier rule.
 */
export function createJavaLanguage(): Monaco.languages.IMonarchLanguage {
  const root = (language.tokenizer.root as unknown[]).slice();
  const identifierRule = root.findIndex(
    (rule) => Array.isArray(rule) && rule[0] instanceof RegExp && rule[0].source === "[a-zA-Z_$][\\w$]*"
  );
  if (identifierRule < 0) throw new Error("Java Monarch grammar changed: identifier rule not found");
  root.splice(
    identifierRule,
    0,
    // return types that are followed by a method name and "(": enter `declaration`
    [new RegExp(PRIMITIVE + "\\b(?=" + DECLARATION_TAIL + ")"), { token: "keyword.$0", next: "@declaration" }],
    [new RegExp("[A-Z][\\w$]*(?=" + DECLARATION_TAIL + ")"), { token: TYPE_TOKEN, next: "@declaration" }],
    [/[A-Z][\w$]*/, TYPE_TOKEN]
  );
  // rest of a declaration head; the lookahead above guarantees that the method name follows
  const declaration = [
    [/\s+/, ""],
    [new RegExp(NAME + "(?=\\s*\\()"), { token: METHOD_DECLARATION_TOKEN, next: "@pop" }],
    [new RegExp(PRIMITIVE + "\\b"), "keyword.$0"],
    [/[A-Z][\w$]*/, TYPE_TOKEN],
    [/[a-zA-Z_$][\w$]*/, "identifier"],
    [/[<>]/, "delimiter.angle"],
    [/[[\]]/, "delimiter.square"],
    [/[,?&.]/, "delimiter"],
    [/./, { token: "@rematch", next: "@pop" }]
  ];
  return { ...language, tokenizer: { ...language.tokenizer, root, declaration } } as Monaco.languages.IMonarchLanguage;
}

/** Registers `java` (instead of the lazy default registration) with the modified grammar. */
export function registerJava(m: typeof Monaco): void {
  m.languages.register({
    id: "java",
    extensions: [".java", ".jav"],
    aliases: ["Java", "java"],
    mimetypes: ["text/x-java-source", "text/x-java"]
  });
  m.languages.setLanguageConfiguration("java", conf as Monaco.languages.LanguageConfiguration);
  m.languages.setMonarchTokensProvider("java", createJavaLanguage());
}
