import { detectMember, maskCode, scanDeclarations, type Declarations } from "./analysis";
import {
  ARRAY_TYPE,
  CLASSES,
  findClass,
  findStaticReceiver,
  type ClassInfo,
  type Member
} from "./catalogue";
import { KEYWORDS, SNIPPETS } from "./keywords";

export type SuggestionKind =
  | "method"
  | "field"
  | "constant"
  | "constructor"
  | "class"
  | "variable"
  | "keyword"
  | "snippet";

/** Editor-independent completion item; provider.ts turns it into a Monaco item. */
export interface Suggestion {
  label: string;
  kind: SuggestionKind;
  /** Shown right of the label, e.g. "(int a, int b): int". */
  detail: string;
  /** Text to insert; a Monaco snippet when `snippet` is true. */
  insert: string;
  snippet: boolean;
  /** German description (plain text). */
  doc: string;
  /** Full signature for the documentation panel, e.g. "int Math.max(int a, int b)". */
  signature?: string;
  /** One-line example, if any. */
  example?: string;
  /** Sort key (smaller first). */
  sort: string;
}

export interface CompletionResult {
  /** Number of characters before the cursor that the suggestion replaces (the typed word). */
  prefixLength: number;
  items: Suggestion[];
}

const EMPTY: CompletionResult = { prefixLength: 0, items: [] };

export function matchesPrefix(label: string, prefix: string): boolean {
  return label.toLowerCase().startsWith(prefix.toLowerCase());
}

function signatureOf(owner: string, m: Member, constructor: boolean): string {
  if (constructor) return `new ${m.name}(${m.params})`;
  if (m.kind !== "method") return `${m.returns} ${owner}.${m.name}`;
  return `${m.returns} ${owner}.${m.name}(${m.params})`;
}

function fromMember(m: Member, index: number, owner: string, constructor = false): Suggestion {
  return {
    signature: signatureOf(owner === "[]" ? "array" : owner, m, constructor),
    label: m.name,
    kind: m.kind === "method" ? "method" : m.kind === "constant" ? "constant" : "field",
    detail: m.detail,
    insert: m.insert,
    snippet: m.kind === "method",
    doc: m.doc,
    example: m.example,
    sort: `0${String(index).padStart(3, "0")}`
  };
}

function membersOf(info: ClassInfo | undefined, which: "statics" | "instance", prefix: string): Suggestion[] {
  if (!info) return [];
  return info[which].map((m, i) => fromMember(m, i, info.name)).filter((s) => matchesPrefix(s.label, prefix));
}

/** Catalogue class for a declared type such as "Scanner", "int[]" or "ArrayList<String>". */
export function classForType(type: string): ClassInfo | undefined {
  if (type.endsWith("[]")) return ARRAY_TYPE;
  const base = type.replace(/<.*$/, "");
  return findClass(base);
}

function lastDeclaration(decls: Declarations, name: string, beforeOffset: number) {
  let found;
  for (const v of decls.variables) {
    if (v.name === name && v.offset < beforeOffset) found = v;
  }
  return found;
}

function memberSuggestions(text: string, offset: number, receiver: string, prefix: string): Suggestion[] {
  if (receiver === '""') return membersOf(findClass("String"), "instance", prefix);
  const { masked } = maskCode(text.slice(0, offset));
  if (!receiver.includes(".")) {
    const variable = lastDeclaration(scanDeclarations(masked), receiver, offset);
    if (variable) return membersOf(classForType(variable.type), "instance", prefix);
  }
  return membersOf(findStaticReceiver(receiver), "statics", prefix);
}

function constructorSuggestions(prefix: string): Suggestion[] {
  const out: Suggestion[] = [];
  for (const c of CLASSES) {
    c.constructors.forEach((m, i) => {
      if (!matchesPrefix(c.name, prefix)) return;
      out.push({ ...fromMember(m, i, c.name, true), label: c.name, kind: "constructor", snippet: true, sort: `0${c.name}${i}` });
    });
  }
  return out;
}

function generalSuggestions(text: string, offset: number, prefix: string): Suggestion[] {
  // Declarations of the whole file, but without the word being typed (it would suggest itself).
  const whole = text.slice(0, offset - prefix.length) + " ".repeat(prefix.length) + text.slice(offset);
  const decls = scanDeclarations(maskCode(whole).masked);
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const add = (s: Suggestion) => {
    const key = `${s.kind}:${s.label}:${s.detail}`;
    if (seen.has(key) || !matchesPrefix(s.label, prefix)) return;
    seen.add(key);
    out.push(s);
  };

  for (const v of decls.variables) {
    add({ label: v.name, kind: "variable", detail: `: ${v.type}`, insert: v.name, snippet: false, doc: "Variable in dieser Datei.", sort: `0${v.name}` });
  }
  for (const m of decls.methods) {
    const hasParams = m.params.length > 0;
    add({
      label: m.name,
      kind: "method",
      detail: `(${m.params})${m.returns === "void" ? "" : `: ${m.returns}`}`,
      insert: hasParams ? `${m.name}(\${1})` : `${m.name}()`,
      snippet: hasParams,
      doc: "Methode in dieser Datei.",
      sort: `0${m.name}`
    });
  }
  for (const s of SNIPPETS) {
    add({ label: s.label, kind: "snippet", detail: s.detail, insert: s.insert, snippet: true, doc: s.doc, sort: `1${s.label}` });
  }
  const snippetLabels = new Set(SNIPPETS.map((s) => s.label));
  for (const k of KEYWORDS) {
    if (snippetLabels.has(k.word)) continue; // the snippet is more useful than the bare keyword
    add({ label: k.word, kind: "keyword", detail: "Schlüsselwort", insert: k.word, snippet: false, doc: k.doc, sort: `2${k.word}` });
  }
  for (const c of CLASSES) {
    add({ label: c.name, kind: "class", detail: "Klasse", insert: c.name, snippet: false, doc: c.doc, example: c.example, sort: `3${c.name}` });
  }
  for (const name of decls.classes) {
    add({ label: name, kind: "class", detail: "Klasse in dieser Datei", insert: name, snippet: false, doc: "Klasse in dieser Datei.", sort: `3${name}` });
  }
  return out;
}

/**
 * All suggestions for the cursor at `offset` in `text`.
 *
 *  - inside strings and comments: nothing
 *  - after `x.`: members of x (declared variable of a catalogue type, or a catalogue class such as
 *    Math, IO, System.out); nothing if x is unknown
 *  - after `new `: constructors of catalogue classes
 *  - otherwise: identifiers of the file, snippets, keywords and catalogue classes
 */
export function getCompletions(text: string, offset: number): CompletionResult {
  const { masked, state } = maskCode(text.slice(0, offset));
  if (state !== "code") return EMPTY;
  const word = /[\w$]*$/.exec(masked)![0];
  if (/^\d/.test(word)) return EMPTY; // typing a number

  const member = detectMember(masked);
  if (member === "unknown") return EMPTY;
  if (member) {
    return { prefixLength: word.length, items: memberSuggestions(text, offset, member.receiver, member.prefix) };
  }

  const beforeWord = masked.slice(0, masked.length - word.length);
  if (/\bimport\s+(?:static\s+)?$/.test(beforeWord) || /\b(?:class|record|enum|interface)\s+$/.test(beforeWord)) return EMPTY;
  if (/\bnew\s+$/.test(beforeWord)) return { prefixLength: word.length, items: constructorSuggestions(word) };
  return { prefixLength: word.length, items: generalSuggestions(text, offset, word) };
}
