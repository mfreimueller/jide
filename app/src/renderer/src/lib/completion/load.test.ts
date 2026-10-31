import { describe, expect, it } from "vitest";
import { CatalogueError, parseCatalogue, parseSignature, splitParams } from "./load";

describe("splitParams", () => {
  it("handles empty and simple lists", () => {
    expect(splitParams("")).toEqual([]);
    expect(splitParams("  ")).toEqual([]);
    expect(splitParams("int a, int b")).toEqual(["int a", "int b"]);
  });
  it("respects angle-bracket depth", () => {
    expect(splitParams("Map<K, V> karte, int n")).toEqual(["Map<K, V> karte", "int n"]);
    expect(splitParams("Map<String, List<Integer>> m")).toEqual(["Map<String, List<Integer>> m"]);
  });
  it("respects parentheses and quotes", () => {
    expect(splitParams('new FileWriter("a,b.txt", true)')).toEqual(['new FileWriter("a,b.txt", true)']);
  });
  it("rejects broken lists", () => {
    expect(() => splitParams("int a,, int b")).toThrow(/Leerer Parameter/);
    expect(() => splitParams("Map<K, V karte")).toThrow(/nicht geschlossen/);
    expect(() => splitParams("int a>")).toThrow(/Unerwartetes/);
  });
});

describe("parseSignature", () => {
  it("parses a no-arg method", () => {
    expect(parseSignature("length(): int")).toEqual({ form: "method", name: "length", params: [], returns: "int" });
  });
  it("parses several params", () => {
    expect(parseSignature("max(int a, int b): int")).toEqual({ form: "method", name: "max", params: [["int", "a"], ["int", "b"]], returns: "int" });
  });
  it("parses generics with commas", () => {
    expect(parseSignature("put(Map<K, V> karte, K key, V value): V")).toEqual({
      form: "method",
      name: "put",
      params: [["Map<K, V>", "karte"], ["K", "key"], ["V", "value"]],
      returns: "V"
    });
    expect(parseSignature("get(int i): ArrayList<E>").form).toBe("method");
  });
  it("parses arrays and varargs", () => {
    expect(parseSignature("copyOf(int[] array, int laenge): int[]")).toMatchObject({ params: [["int[]", "array"], ["int", "laenge"]], returns: "int[]" });
    expect(parseSignature("printf(String format, Object... werte): PrintStream")).toMatchObject({ params: [["String", "format"], ["Object...", "werte"]] });
  });
  it("parses fields", () => {
    expect(parseSignature("PI: double")).toEqual({ form: "field", name: "PI", type: "double" });
    expect(parseSignature("liste: ArrayList<String>")).toEqual({ form: "field", name: "liste", type: "ArrayList<String>" });
  });
  it("parses constructors (no return type), also with placeholder params", () => {
    expect(parseSignature("Random()")).toEqual({ form: "method", name: "Random", params: [], returns: "" });
    expect(parseSignature("Scanner(System.in)")).toMatchObject({ params: [["", "System.in"]], returns: "" });
    expect(parseSignature('BufferedReader(new FileReader("datei.txt"))')).toMatchObject({ params: [["", 'new FileReader("datei.txt")']] });
  });
  it("rejects malformed signatures", () => {
    expect(() => parseSignature("max(int a")).toThrow(/Klammer/);
    expect(() => parseSignature("max(int a) int")).toThrow(/Rückgabetyp/);
    expect(() => parseSignature("max")).toThrow(/Weder Methode/);
    expect(() => parseSignature("1x(): int")).toThrow(/Name/);
    expect(() => parseSignature("PI: do uble")).toThrow(/Typ/);
  });
});

const ok = (extra = "") => `
- class: Demo
  doc: Eine Klasse.
  example: x
${extra}
- class: "[]"
  kind: array
  doc: Array.
  example: y
`;

describe("parseCatalogue", () => {
  it("builds members with detail, insert and kinds", () => {
    const c = parseCatalogue(
      ok(`  constructors:
    - sig: "Demo(int a)"
      doc: d
      example: e
  static:
    - sig: "MAX: int"
      constant: true
      doc: d
      example: e
    - sig: "of(String s, Object... rest): Demo"
      doc: d
      example: e`)
    );
    const demo = c.classes[0];
    expect(demo.constructors[0]).toMatchObject({ name: "Demo", kind: "method", detail: "(int a)", returns: "", insert: "Demo(${1:a})" });
    expect(demo.statics[0]).toMatchObject({ name: "MAX", kind: "constant", detail: ": int", insert: "MAX" });
    expect(demo.statics[1]).toMatchObject({ detail: "(String s, Object... rest): Demo", params: "String s, Object... rest", insert: "of(${1:s}, ${2:rest})" });
    expect(c.array.name).toBe("[]");
  });

  it("separates receivers from classes", () => {
    const c = parseCatalogue(ok() + "- class: System.out\n  kind: receiver\n  doc: d\n  example: e\n");
    expect(c.classes.map((x) => x.name)).toEqual(["Demo"]);
    expect(c.receivers.map((x) => x.name)).toEqual(["System.out"]);
  });

  const fails = (yaml: string, ...parts: string[]) => {
    let err: unknown;
    try {
      parseCatalogue(yaml);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CatalogueError);
    for (const p of parts) expect((err as Error).message).toContain(p);
  };

  it("names class and signature for a broken signature", () => {
    fails(ok(`  static:\n    - sig: "max(int a"\n      doc: d\n      example: e`), 'Klasse "Demo"', 'Signatur "max(int a"');
  });
  it("names class and signature for a missing doc", () => {
    fails(ok(`  instance:\n    - sig: "size(): int"\n      example: e`), 'Klasse "Demo"', 'Signatur "size(): int"', "doc");
  });
  it("names class and signature for unknown keys (typos)", () => {
    fails(ok(`  instance:\n    - sig: "size(): int"\n      doc: d\n      exampel: e`), 'Signatur "size(): int"', "exampel");
  });
  it("rejects wrong constructor name, missing return type and constant on methods", () => {
    fails(ok(`  constructors:\n    - sig: "Other()"\n      doc: d\n      example: e`), 'Klasse "Demo"', 'Signatur "Other()"', "Demo");
    fails(ok(`  static:\n    - sig: "run()"\n      doc: d\n      example: e`), 'Signatur "run()"', "Rückgabetyp");
    fails(ok(`  static:\n    - sig: "run(): void"\n      constant: true\n      doc: d\n      example: e`), 'Signatur "run(): void"', "constant");
    fails(ok(`  static:\n    - sig: "run(Scanner.in): void"\n      doc: d\n      example: e`), 'Signatur "run(Scanner.in): void"', "Typ name");
  });
  it("reports every problem, duplicates, missing array and bad YAML", () => {
    fails(ok(`  static:\n    - sig: "a("\n      doc: d\n      example: e\n    - sig: "b("\n      doc: d\n      example: e`), 'Signatur "a("', 'Signatur "b("');
    fails(ok() + "- class: Demo\n  doc: d\n  example: e\n", "mehrfach");
    fails("- class: Demo\n  doc: d\n  example: e\n", "kind: array");
    fails("a: [", "ungültiges YAML");
    fails("class: Demo", "Liste");
    fails("- doc: d\n", "Eintrag 1");
  });
});
