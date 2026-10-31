/** Types and constructors for catalogue entries (the data itself lives in app/catalogue.yaml). */

export type MemberKind = "method" | "field" | "constant";

export interface Member {
  name: string;
  kind: MemberKind;
  /** Shown next to the label, e.g. "(int a, int b): int" or ": double". */
  detail: string;
  /** Parameter list as written, e.g. "int a, int b" (empty for fields and no-arg methods). */
  params: string;
  /** Return or field type, empty for constructors. */
  returns: string;
  /** Monaco snippet text with placeholders for parameters. */
  insert: string;
  /** Short German description. */
  doc: string;
  /** One-line example. */
  example: string;
}

export interface ClassInfo {
  name: string;
  /** Short German description of the class. */
  doc: string;
  example: string;
  /** Constructors, offered after `new `. */
  constructors: Member[];
  /** Static members: `Math.max`, `IO.println`, `System.out.println` (class name "System.out"). */
  statics: Member[];
  /** Instance members: `sc.nextInt()`. */
  instance: Member[];
}

export type Param = readonly [type: string, name: string];

export function method(name: string, params: Param[], returns: string, doc: string, example: string): Member {
  const list = params.map(([t, n]) => `${t} ${n}`.trim()).join(", ");
  const detail = `(${list})` + (returns ? `: ${returns}` : "");
  const insert = `${name}(${params.map(([, n], i) => `\${${i + 1}:${n}}`).join(", ")})`;
  return { name, kind: "method", detail, params: list, returns, insert, doc, example };
}

export function field(name: string, type: string, doc: string, example: string, kind: MemberKind = "field"): Member {
  return { name, kind, detail: `: ${type}`, params: "", returns: type, insert: name, doc, example };
}

export function ctor(className: string, params: Param[], doc: string, example: string): Member {
  const m = method(className, params, "", doc, example);
  return { ...m, name: className };
}
