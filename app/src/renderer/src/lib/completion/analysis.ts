/**
 * Lightweight text analysis for completion. No parser: strings and comments are blanked out and
 * declarations are found with regular expressions (SPEC 3.1, Option A).
 */

export type LexState = "code" | "line-comment" | "block-comment" | "string" | "char" | "text-block";

export interface Masked {
  /** Same length as the input; contents of comments, strings and chars are replaced by spaces. */
  masked: string;
  /** Lexical state at the very end of the input. */
  state: LexState;
}

/** Blanks out comments and string/char contents (quotes stay, newlines stay, offsets are kept). */
export function maskCode(text: string): Masked {
  const out: string[] = [];
  let state: LexState = "code";
  let i = 0;
  const blank = (c: string) => (c === "\n" || c === "\r" ? c : " ");
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    switch (state) {
      case "code":
        if (c === "/" && next === "/") {
          state = "line-comment";
          out.push("  ");
          i += 2;
        } else if (c === "/" && next === "*") {
          state = "block-comment";
          out.push("  ");
          i += 2;
        } else if (c === '"' && next === '"' && text[i + 2] === '"') {
          state = "text-block";
          out.push('"""');
          i += 3;
        } else if (c === '"') {
          state = "string";
          out.push(c);
          i++;
        } else if (c === "'") {
          state = "char";
          out.push(c);
          i++;
        } else {
          out.push(c);
          i++;
        }
        break;
      case "line-comment":
        if (c === "\n") state = "code";
        out.push(blank(c));
        i++;
        break;
      case "block-comment":
        if (c === "*" && next === "/") {
          state = "code";
          out.push("  ");
          i += 2;
        } else {
          out.push(blank(c));
          i++;
        }
        break;
      case "string":
      case "char": {
        const quote = state === "string" ? '"' : "'";
        if (c === "\\" && next !== undefined) {
          out.push(" ", blank(next));
          i += 2;
        } else if (c === quote) {
          state = "code";
          out.push(c);
          i++;
        } else if (c === "\n") {
          state = "code"; // unterminated literal ends at the line break
          out.push(c);
          i++;
        } else {
          out.push(" ");
          i++;
        }
        break;
      }
      case "text-block":
        if (c === '"' && next === '"' && text[i + 2] === '"') {
          state = "code";
          out.push('"""');
          i += 3;
        } else if (c === "\\" && next !== undefined) {
          out.push(" ", blank(next));
          i += 2;
        } else {
          out.push(blank(c));
          i++;
        }
        break;
    }
  }
  return { masked: out.join(""), state };
}

export interface Variable {
  name: string;
  /** Declared type as written, e.g. "Scanner", "int[]", "ArrayList<String>"; "var" is resolved when possible. */
  type: string;
  /** Offset of the declaration in the analysed text. */
  offset: number;
}

export interface MethodDecl {
  name: string;
  returns: string;
  /** Parameter list as written, e.g. "int a, int b". */
  params: string;
}

export interface Declarations {
  variables: Variable[];
  methods: MethodDecl[];
  classes: string[];
}

const PRIMITIVES = "byte|short|int|long|float|double|boolean|char";
const GENERIC = String.raw`(?:<[^<>;(){}]*(?:<[^<>;(){}]*>)?[^<>;(){}]*>)?`;
const TYPE = String.raw`(?:(?:${PRIMITIVES})|[A-Z][\w$]*)${GENERIC}(?:\s*\[\s*\])*`;
const IDENT = String.raw`[A-Za-z_$][\w$]*`;

const VARIABLE_RE = new RegExp(String.raw`(?<![\w$.])(${TYPE}|var)\s+(${IDENT})\s*(?=[=;,:)])`, "g");
const MORE_NAMES_RE = new RegExp(String.raw`\s*(?:=[^,;(){}]*)?,\s*(${IDENT})\s*(?=[=,;])`, "y");
const METHOD_RE = new RegExp(
  String.raw`(?<![\w$.])(${TYPE}|void)\s+(${IDENT})\s*\(([^()]*)\)\s*(?:throws\s+[\w$.,\s]+)?\{`,
  "g"
);
const CLASS_RE = /\b(?:class|record|enum|interface)\s+([A-Z][\w$]*)/g;
const NEW_TYPE_RE = /^\s*=\s*new\s+([A-Z][\w$]*)/;

/** Finds variables, parameters, methods and classes declared in (already masked) code. */
export function scanDeclarations(masked: string): Declarations {
  const variables: Variable[] = [];
  const methods: MethodDecl[] = [];
  const classes: string[] = [];

  for (const m of masked.matchAll(VARIABLE_RE)) {
    let type = m[1].replace(/\s+/g, "");
    if (type === "var") {
      const init = NEW_TYPE_RE.exec(masked.slice(m.index + m[0].length));
      type = init ? init[1] : "var";
    }
    variables.push({ name: m[2], type, offset: m.index });
    // `int a = 5, b = 3;` -> also b
    MORE_NAMES_RE.lastIndex = m.index + m[0].length;
    for (let more = MORE_NAMES_RE.exec(masked); more; more = MORE_NAMES_RE.exec(masked)) {
      variables.push({ name: more[1], type, offset: more.index });
      MORE_NAMES_RE.lastIndex = more.index + more[0].length;
    }
  }
  for (const m of masked.matchAll(METHOD_RE)) {
    methods.push({ name: m[2], returns: m[1].replace(/\s+/g, ""), params: m[3].trim().replace(/\s+/g, " ") });
  }
  for (const m of masked.matchAll(CLASS_RE)) classes.push(m[1]);
  return { variables, methods, classes };
}

export interface MemberContext {
  /** Receiver chain without whitespace, e.g. "sc", "Math", "System.out"; "\"\"" for a string literal. */
  receiver: string;
  /** Characters typed after the dot. */
  prefix: string;
}

/**
 * Detects `receiver.prefix` at the end of masked code. Returns:
 *  - a MemberContext when the cursor is right after `ident.` / `a.b.` / `"literal".`
 *  - "unknown" when the cursor is after a dot but the receiver is something we do not analyse
 *    (method call result, array element, number, ...) -> the caller offers nothing
 *  - undefined when there is no dot before the typed word
 */
export function detectMember(masked: string): MemberContext | "unknown" | undefined {
  const word = /[\w$]*$/.exec(masked)![0];
  const beforeWord = masked.slice(0, masked.length - word.length);
  if (!/\.\s*$/.test(beforeWord)) return undefined;
  const chain = new RegExp(String.raw`(?<![\w$.)\]])(${IDENT}(?:\s*\.\s*${IDENT})*)\s*\.\s*$`).exec(beforeWord);
  if (chain) return { receiver: chain[1].replace(/\s+/g, ""), prefix: word };
  if (/"[ ]*"\s*\.\s*$/.test(beforeWord)) {
    return { receiver: '""', prefix: word };
  }
  return "unknown";
}
