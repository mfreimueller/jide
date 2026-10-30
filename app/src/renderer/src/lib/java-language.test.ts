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
    expect(t).toContain("main:identifier.java");
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
