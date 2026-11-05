import { describe, expect, it } from "vitest";
import { maskCode, scanDeclarations } from "./analysis";
import { STATIC_RECEIVERS } from "./catalogue";
import { getCompletions } from "./suggest";

/** Completions for the text with `|` marking the cursor. */
function at(source: string) {
  const offset = source.indexOf("|");
  const text = source.replace("|", "");
  return getCompletions(text, offset);
}
const labels = (source: string) => at(source).items.map((i) => i.label);

describe("maskCode", () => {
  it("blanks strings and comments but keeps offsets", () => {
    const src = 'int a; // Scanner s\nString t = "Math."; /* x */';
    const { masked, state } = maskCode(src);
    expect(masked).toHaveLength(src.length);
    expect(masked).not.toContain("Scanner");
    expect(masked).not.toContain("Math");
    expect(state).toBe("code");
  });
  it("reports the open state at the end", () => {
    expect(maskCode('IO.println("abc').state).toBe("string");
    expect(maskCode("// Math.").state).toBe("line-comment");
    expect(maskCode("/* Math.").state).toBe("block-comment");
    expect(maskCode("// x\nint a;").state).toBe("code");
  });
});

describe("scanDeclarations", () => {
  it("finds variables, parameters, methods and var with new", () => {
    const d = scanDeclarations(
      maskCode(`int summe(int a, int b) { return a + b; }
void main() { Scanner sc = new Scanner(System.in); int x = 1, y = 2; var r = new Random(); int[] zahlen = {1}; }`).masked
    );
    const vars = Object.fromEntries(d.variables.map((v) => [v.name, v.type]));
    expect(vars).toMatchObject({ a: "int", b: "int", sc: "Scanner", x: "int", y: "int", r: "Random", zahlen: "int[]" });
    expect(d.methods.map((m) => m.name)).toEqual(["summe", "main"]);
    expect(d.methods[0].params).toBe("int a, int b");
  });
  it("does not treat return/new statements as declarations", () => {
    const d = scanDeclarations(maskCode("void f() { return value; new Foo(); }").masked);
    expect(d.variables).toEqual([]);
  });
  it("finds catch parameters", () => {
    const d = scanDeclarations(maskCode("try { } catch (IOException e) { }").masked);
    expect(d.variables).toMatchObject([{ name: "e", type: "IOException" }]);
  });
});

describe("member completion", () => {
  it("Math.m -> max, min", () => {
    expect(labels("void main() { int g = Math.m| }")).toEqual(["max", "min"]);
  });
  it("Math. lists max, abs, sqrt", () => {
    expect(labels("Math.|")).toEqual(expect.arrayContaining(["max", "min", "abs", "sqrt"]));
  });
  it("IO. and System.out.", () => {
    expect(labels("IO.|")).toEqual(["println", "print", "readln"]);
    expect(labels("System.out.|")).toEqual(["println", "print", "printf"]);
    expect(labels("System.|")).toEqual(["out", "in"]);
  });
  it("Integer.parse -> parseInt", () => {
    expect(labels("Integer.parse|")).toEqual(["parseInt"]);
  });
  it("Scanner variable -> Scanner members", () => {
    const l = labels("void main() {\n  Scanner sc = new Scanner(System.in);\n  sc.|\n}");
    expect(l).toEqual(expect.arrayContaining(["nextInt", "nextLine", "nextDouble", "next", "hasNextInt", "close"]));
    expect(l).not.toContain("max");
  });
  it("prefix filters members", () => {
    expect(labels("Scanner sc = new Scanner(System.in);\nsc.nextI|")).toEqual(["nextInt"]);
  });
  it("String variable -> String methods", () => {
    expect(labels('String s = "x";\ns.|')).toEqual(expect.arrayContaining(["length", "charAt", "equals", "toUpperCase"]));
  });
  it("array variable -> length", () => {
    expect(labels("int[] a = new int[3];\na.|")).toEqual(["length"]);
    expect(labels("String[] namen = {};\nnamen.|")).toEqual(["length"]);
  });
  it("parameter and catch variables", () => {
    expect(labels("int f(int[] zahlen) { return zahlen.l| }")).toEqual(["length"]);
    expect(labels("try { } catch (IOException e) { e.| }")).toEqual(["getMessage"]);
  });
  it("string literal receiver", () => {
    expect(labels('"abc".len|')).toEqual(["length"]);
  });
  it("the last declaration before the cursor wins", () => {
    expect(labels('String x = "";\nScanner x = new Scanner(System.in);\nx.nextL|')).toEqual(["nextLine"]);
  });
  it("unknown receiver -> nothing", () => {
    expect(at("foo.|").items).toEqual([]);
    expect(at("int n = 5;\nn.|").items).toEqual([]);
    expect(at("sc.nextLine().|").items).toEqual([]);
    expect(at("zahlen[0].|").items).toEqual([]);
    expect(at("double d = 1.|").items).toEqual([]);
  });
});

describe("strings and comments", () => {
  it("offers nothing inside strings and comments", () => {
    expect(at('IO.println("Math.m|").').items).toEqual([]);
    expect(at('String s = "ab|').items).toEqual([]);
    expect(at("// Math.m|").items).toEqual([]);
    expect(at("/* sc.| */").items).toEqual([]);
    expect(at("/** Beschreibung wh| */").items).toEqual([]);
  });
  it("works again after the comment/string", () => {
    expect(labels('// Kommentar\nString s = "x"; Math.ab|')).toEqual(["abs"]);
  });
  it("ignores declarations inside comments", () => {
    expect(at("// Scanner sc = new Scanner(System.in);\nsc.|").items).toEqual([]);
  });
});

describe("general completion", () => {
  it("offers identifiers of the file with kinds", () => {
    const r = at("int summe(int a, int b) { return a + b; }\nvoid main() { int zaehler = 0; zae| }");
    expect(r.items.map((i) => [i.label, i.kind])).toEqual([["zaehler", "variable"]]);
    expect(r.prefixLength).toBe(3);
  });
  it("does not suggest the word being typed", () => {
    expect(labels("void main() { int zaehl| }")).toEqual([]);
  });
  it("offers methods", () => {
    const r = at("int summe(int a, int b) { return a + b; }\nvoid main() { su| }");
    expect(r.items.find((i) => i.label === "summe")).toMatchObject({ kind: "method", detail: "(int a, int b): int" });
  });
  it("offers keywords, snippets and classes", () => {
    expect(labels("void main() { | }")).toEqual(
      expect.arrayContaining(["if", "for", "while", "switch", "return", "int", "Scanner", "Math", "IO", "String"])
    );
  });
  it("snippets take the place of the bare keyword", () => {
    const fors = at("void main() { fo| }").items.filter((i) => i.label === "for");
    expect(fors.map((i) => i.kind)).toEqual(["snippet", "snippet"]);
  });
  it("sout expands to System.out.println", () => {
    const sout = at("void main() { sou| }").items.filter((i) => i.label === "sout");
    expect(sout).toHaveLength(1);
    expect(sout[0]).toMatchObject({ kind: "snippet", insert: "System.out.println($0);", snippet: true });
  });
  it("after new: constructors", () => {
    const r = at("Scanner sc = new Sc|");
    expect(r.items.map((i) => [i.label, i.kind, i.insert])).toEqual([["Scanner", "constructor", "Scanner(${1:System.in})"]]);
  });
  it("nothing after import/class and while typing numbers", () => {
    expect(at("import java.util.|").items).toEqual([]);
    expect(at("import |").items).toEqual([]);
    expect(at("class |").items).toEqual([]);
    expect(at("int x = 12|").items).toEqual([]);
  });
});

describe("catalogue", () => {
  it("every member has a German description and an example", () => {
    for (const c of STATIC_RECEIVERS) {
      for (const m of [...c.constructors, ...c.statics, ...c.instance]) {
        expect(m.doc.length, `${c.name}.${m.name}`).toBeGreaterThan(5);
        expect(m.example.length, `${c.name}.${m.name}`).toBeGreaterThan(3);
      }
    }
  });
});
