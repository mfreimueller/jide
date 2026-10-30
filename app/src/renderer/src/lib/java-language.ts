import type * as Monaco from "monaco-editor/editor/editor.api";
import { conf, language } from "monaco-editor/languages/definitions/java/java";

/** Token for identifiers that start with an uppercase letter ("types", see SPEC 3.1). */
export const TYPE_TOKEN = "type.identifier";

/**
 * Monaco's Java Monarch grammar with one extra rule: identifiers starting with an uppercase
 * letter get the token `type.identifier` (the original grammar has no type tokens). Java
 * keywords are all lowercase, so the new rule is simply put in front of the identifier rule.
 */
export function createJavaLanguage(): Monaco.languages.IMonarchLanguage {
  const root = (language.tokenizer.root as unknown[]).slice();
  const identifierRule = root.findIndex(
    (rule) => Array.isArray(rule) && rule[0] instanceof RegExp && rule[0].source === "[a-zA-Z_$][\\w$]*"
  );
  if (identifierRule < 0) throw new Error("Java Monarch grammar changed: identifier rule not found");
  root.splice(identifierRule, 0, [/[A-Z][\w$]*/, TYPE_TOKEN]);
  return { ...language, tokenizer: { ...language.tokenizer, root } } as Monaco.languages.IMonarchLanguage;
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
