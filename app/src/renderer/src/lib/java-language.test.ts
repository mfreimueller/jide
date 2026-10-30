// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";

let monaco: typeof import("monaco-editor/editor/editor.api");

beforeAll(async () => {
  // jsdom has no matchMedia, which Monaco's theme service calls on start-up
  window.matchMedia ??= ((query: string) =>
    ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
  monaco = await import("monaco-editor/editor/editor.api");
  (await import("./java-language")).registerJava(monaco);
});

/** Tokens of one line as "text:token" pairs, whitespace-only tokens removed. */
function tokens(line: string): string[] {
  const [tokenized] = monaco.editor.tokenize(line, "java");
  return tokenized
    .map((t, i, all) => `${line.slice(t.offset, all[i + 1]?.offset ?? line.length)}:${t.type}`)
    .filter((s) => !/^\s+:/.test(s));
}

describe("java tokenizer with type colouring", () => {
  it("colours identifiers starting with an uppercase letter as types", () => {
    const t = tokens("Scanner sc = new Scanner(System.in);");
    expect(t).toContain("Scanner:type.identifier.java");
    expect(t).toContain("System:type.identifier.java");
    expect(t).toContain("sc:identifier.java");
    expect(t).toContain("new:keyword.new.java");
    expect(t).toContain("in:identifier.java");
  });
  it("keeps keywords, strings, numbers and comments", () => {
    const t = tokens('void main() { int x = 42; IO.println("Hi"); } // Ende');
    expect(t).toContain("void:keyword.void.java");
    expect(t).toContain("int:keyword.int.java");
    expect(t).toContain("42:number.java");
    expect(t).toContain("IO:type.identifier.java");
    expect(t).toContain("main:entity.name.function.declaration.java");
    expect(t.some((s) => s.includes('"') && s.endsWith(":string.java"))).toBe(true);
    expect(t.some((s) => s.includes("// Ende") && s.endsWith(":comment.java"))).toBe(true);
  });
  it("does not colour uppercase letters inside identifiers, strings or comments", () => {
    const t = tokens('int zahlEins = 1; String s = "Scanner"; // Math');
    expect(t).toContain("zahlEins:identifier.java");
    expect(t.filter((s) => s.endsWith(":type.identifier.java"))).toEqual(["String:type.identifier.java"]);
  });
  it("only identifiers that start with an uppercase letter are types", () => {
    const t = tokens("_Foo $Bar Baz_1 true");
    expect(t).toContain("_Foo:identifier.java");
    expect(t).toContain("$Bar:identifier.java");
    expect(t).toContain("Baz_1:type.identifier.java");
    expect(t).toContain("true:keyword.true.java");
  });
});

const DECL = "entity.name.function.declaration.java";
const decls = (line: string) => tokens(line).filter((t) => t.endsWith(":" + DECL));

describe("method declaration names", () => {
  it.each([
    ["int maximum(int a, int b) {", "maximum"],
    ["void main() {", "main"],
    ["int[] zahlen(int n) {", "zahlen"],
    ["String getName() {", "getName"],
    ["static int summe(int a, int b) {", "summe"],
    ["public void setName(String name) {", "setName"],
    ["List<String> namen() {", "namen"],
    ["Map<String, List<Integer>> tabelle() {", "tabelle"],
    ["String[][] gitter() {", "gitter"],
    ["double  wurzel (double x) {", "wurzel"]
  ])("marks the name in %s", (line, name) => {
    expect(decls(line)).toEqual([`${name}:${DECL}`]);
  });

  it.each([
    "int x = maximum(3, 7);",
    "maximum(3, 7);",
    "int n = sc.nextInt();",
    "IO.println(maximum(1, 2));",
    "return maximum(1, 2);",
    "Scanner sc = new Scanner(System.in);",
    "new Scanner(System.in);",
    "if (x > 1) {",
    "while (x > 1) {",
    "for (int i = 0; i < 3; i++) {",
    "switch (x) {",
    "} catch (Exception e) {",
    "int x = foo();",
    "String s = getName();",
    "Person(String name) {",
    "public Person(String name) {",
    "else if (a) {"
  ])("does not mark anything in %s", (line) => {
    expect(decls(line)).toEqual([]);
  });

  it("keeps the type colour on return types and keyword tokens", () => {
    const t = tokens("String getName() {");
    expect(t).toContain("String:type.identifier.java");
    expect(t).toContain(`getName:${DECL}`);
    const u = tokens("static int summe(int a, int b) {");
    expect(u).toContain("static:keyword.static.java");
    expect(u).toContain("int:keyword.int.java");
    expect(u).toContain(`summe:${DECL}`);
    expect(tokens("void main() {")).toContain("void:keyword.void.java");
  });

  it("keeps type colours inside generics and arrays of the return type", () => {
    const t = tokens("Map<String, List<Integer>> tabelle() {");
    expect(t.filter((s) => s.endsWith(":type.identifier.java")).map((s) => s.split(":")[0])).toEqual([
      "Map", "String", "List", "Integer"
    ]);
    expect(tokens("int[] zahlen(int n) {")).toContain("int:keyword.int.java");
  });

  it("tokenizes the rest of the line normally", () => {
    const t = tokens("int maximum(int a, int b) { return a; } // Ende");
    expect(t).toContain("a:identifier.java");
    expect(t).toContain("return:keyword.return.java");
    expect(t.some((s) => s.includes("// Ende") && s.endsWith(":comment.java"))).toBe(true);
  });
});
