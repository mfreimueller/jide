/**
 * Loader for the completion catalogue (app/catalogue.yaml): parses the YAML text, validates it with zod
 * and builds the same ClassInfo/Member objects the completion code always used.
 * Every error names the class and the signature that is wrong.
 */
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { ctor, field, method, type ClassInfo, type Member, type Param } from "./model";

export class CatalogueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogueError";
  }
}

export interface Catalogue {
  /** Real classes (`kind` omitted or "class"). */
  classes: ClassInfo[];
  /** Static "paths" such as `System.out` that are not classes of their own. */
  receivers: ClassInfo[];
  /** Pseudo class for variables of an array type. */
  array: ClassInfo;
}

// ---------------------------------------------------------------- signature parsing

export type ParsedSignature =
  | { form: "method"; name: string; params: Param[]; returns: string }
  | { form: "field"; name: string; type: string };

const IDENT = /^[A-Za-z_]\w*$/;
/** A type: `int`, `String[]`, `Object...`, `Map<K, V>`, `java.util.List<String>`. */
const TYPE = /^[A-Za-z_][\w.]*(?:<[^()"']+>)?(?:\[\])*(?:\.\.\.)?$/;
/** A parameter `Typ name`. Anything else (e.g. `System.in`, `new FileReader("a.txt")`) is a literal placeholder. */
const TYPED_PARAM = /^([A-Za-z_][\w.]*(?:<[^()"']+>)?(?:\[\])*(?:\.\.\.)?)\s+([A-Za-z_]\w*)$/;

/** Index of the `)` that closes the `(` at `open`, respecting nesting and string/char literals; -1 if none. */
function findClosingParen(s: string, open: number): number {
  let depth = 0;
  let quote = "";
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return i;
  }
  return -1;
}

/** Splits a parameter list at top-level commas (commas inside `<>`, `()`, `[]` and quotes do not count). */
export function splitParams(text: string): string[] {
  if (text.trim() === "") return [];
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "<" || c === "(" || c === "[") depth++;
    else if (c === ">" || c === ")" || c === "]") {
      if (--depth < 0) throw new Error(`Unerwartetes "${c}" in der Parameterliste`);
    } else if (c === "," && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  if (depth !== 0 || quote) throw new Error("Klammern oder Anführungszeichen in der Parameterliste nicht geschlossen");
  parts.push(text.slice(start));
  return parts.map((p) => {
    const t = p.trim();
    if (!t) throw new Error("Leerer Parameter (doppeltes oder abschließendes Komma?)");
    return t;
  });
}

/** Parses `name(Typ a, Typ b): Rueckgabe`, `name(): Rueckgabe`, `Klasse(params)` (constructor) or `name: Typ` (field). */
export function parseSignature(sig: string): ParsedSignature {
  const s = sig.trim();
  const open = s.indexOf("(");
  const colon = s.indexOf(":");
  if (open === -1 || (colon !== -1 && colon < open)) {
    const m = /^([A-Za-z_]\w*)\s*:\s*(\S.*)$/.exec(s);
    if (!m) throw new Error('Weder Methode "name(Typ a): Typ" noch Feld "name: Typ"');
    const type = m[2].trim();
    if (!TYPE.test(type)) throw new Error(`Ungültiger Typ "${type}"`);
    return { form: "field", name: m[1], type };
  }
  const name = s.slice(0, open).trim();
  if (!IDENT.test(name)) throw new Error(`Ungültiger Name "${name}"`);
  const close = findClosingParen(s, open);
  if (close === -1) throw new Error('Schließende Klammer ")" fehlt');
  const rest = s.slice(close + 1).trim();
  let returns = "";
  if (rest !== "") {
    const m = /^:\s*(\S.*)$/.exec(rest);
    if (!m) throw new Error(`Nach der Klammer wird ": Rückgabetyp" erwartet, gefunden: "${rest}"`);
    returns = m[1].trim();
    if (!TYPE.test(returns)) throw new Error(`Ungültiger Rückgabetyp "${returns}"`);
  }
  const params: Param[] = splitParams(s.slice(open + 1, close)).map((p) => {
    const m = TYPED_PARAM.exec(p);
    return m ? ([m[1], m[2]] as const) : (["", p] as const);
  });
  return { form: "method", name, params, returns };
}

// ---------------------------------------------------------------- schema

const text = z.string().trim().min(1, "darf nicht leer sein");

const memberSchema = z.strictObject({
  sig: text,
  doc: text,
  example: text,
  constant: z.boolean().optional()
});

const classSchema = z.strictObject({
  class: text,
  kind: z.enum(["class", "receiver", "array"]).optional(),
  doc: text,
  example: text,
  constructors: z.array(memberSchema).optional(),
  static: z.array(memberSchema).optional(),
  instance: z.array(memberSchema).optional()
});

type MemberEntry = z.infer<typeof memberSchema>;
type Section = "constructors" | "static" | "instance";
const SECTIONS: readonly Section[] = ["constructors", "static", "instance"];

function buildMember(className: string, section: Section, e: MemberEntry): Member {
  const p = parseSignature(e.sig);
  if (section === "constructors") {
    if (p.form !== "method" || p.returns !== "") throw new Error('Konstruktor muss die Form "Klasse(Parameter)" haben (ohne Rückgabetyp)');
    if (p.name !== className) throw new Error(`Konstruktor muss "${className}" heißen, nicht "${p.name}"`);
    if (e.constant) throw new Error('"constant" ist nur bei Feldern erlaubt');
    return ctor(className, p.params, e.doc, e.example);
  }
  if (p.form === "field") return field(p.name, p.type, e.doc, e.example, e.constant ? "constant" : "field");
  if (e.constant) throw new Error('"constant: true" ist nur bei Feldern ("NAME: Typ") erlaubt');
  if (p.returns === "") throw new Error('Rückgabetyp fehlt (z. B. "name(): void")');
  if (p.params.some(([type]) => type === "")) throw new Error('Jeder Parameter muss "Typ name" sein');
  return method(p.name, p.params, p.returns, e.doc, e.example);
}

function describePath(item: unknown, path: PropertyKey[]): string {
  const [sec, idx] = path;
  if (typeof sec === "string" && typeof idx === "number" && typeof item === "object" && item !== null) {
    const sig = ((item as Record<string, unknown>)[sec] as { sig?: unknown }[] | undefined)?.[idx]?.sig;
    if (typeof sig === "string") return `, Signatur "${sig}"`;
    return `, ${sec}[${idx + 1}]`;
  }
  return "";
}

// ---------------------------------------------------------------- loading

/** Parses and validates the catalogue YAML. Throws a CatalogueError listing every problem found. */
export function parseCatalogue(yamlText: string): Catalogue {
  let raw: unknown;
  try {
    raw = parseYaml(yamlText);
  } catch (e) {
    throw new CatalogueError(`Katalog: ungültiges YAML: ${(e as Error).message}`);
  }
  if (!Array.isArray(raw)) throw new CatalogueError("Katalog: Die Datei muss eine Liste von Klassen sein (Einträge mit '- class: …').");

  const errors: string[] = [];
  const classes: ClassInfo[] = [];
  const receivers: ClassInfo[] = [];
  const arrays: ClassInfo[] = [];
  const seen = new Set<string>();

  raw.forEach((item: unknown, i) => {
    const rawName = (item as { class?: unknown } | null)?.class;
    const label = typeof rawName === "string" && rawName ? `Klasse "${rawName}"` : `Eintrag ${i + 1}`;
    const r = classSchema.safeParse(item);
    if (!r.success) {
      for (const issue of r.error.issues) errors.push(`${label}${describePath(item, issue.path)}: ${issue.message}${issue.path.length ? ` (${issue.path.join(".")})` : ""}`);
      return;
    }
    const c = r.data;
    if (seen.has(c.class)) errors.push(`${label}: Klasse kommt mehrfach vor`);
    seen.add(c.class);

    const lists: Record<Section, Member[]> = { constructors: [], static: [], instance: [] };
    for (const section of SECTIONS) {
      for (const e of c[section] ?? []) {
        try {
          lists[section].push(buildMember(c.class, section, e));
        } catch (err) {
          errors.push(`${label}, Signatur "${e.sig}": ${(err as Error).message}`);
        }
      }
    }
    const info: ClassInfo = { name: c.class, doc: c.doc, example: c.example, constructors: lists.constructors, statics: lists.static, instance: lists.instance };
    const kind = c.kind ?? "class";
    (kind === "receiver" ? receivers : kind === "array" ? arrays : classes).push(info);
  });

  if (arrays.length !== 1) errors.push(`Katalog: Genau ein Eintrag mit "kind: array" erwartet, gefunden: ${arrays.length}`);
  if (errors.length) throw new CatalogueError(`Katalog fehlerhaft:\n- ${errors.join("\n- ")}`);
  return { classes, receivers, array: arrays[0] };
}
