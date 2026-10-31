import { describe, expect, it } from "vitest";
import { ARRAY_TYPE, CLASSES, findClass, findStaticReceiver, STATIC_RECEIVERS } from "./catalogue";

describe("app/catalogue.yaml", () => {
  it("loads and contains the expected classes", () => {
    const names = CLASSES.map((c) => c.name);
    for (const n of ["IO", "System", "String", "Math", "Scanner", "Random", "Integer", "Double", "Boolean", "Character", "Arrays", "FileReader", "BufferedReader", "FileWriter", "PrintWriter", "IOException", "FileNotFoundException", "Exception"]) {
      expect(names).toContain(n);
    }
    expect(names).not.toContain("System.out");
    expect(STATIC_RECEIVERS.map((c) => c.name)).toContain("System.out");
    expect(findStaticReceiver("System.out")?.statics.map((m) => m.name)).toEqual(["println", "print", "printf"]);
    expect(ARRAY_TYPE.instance.map((m) => m.name)).toEqual(["length"]);
  });

  it("has unique class names and complete members", () => {
    expect(new Set(CLASSES.map((c) => c.name)).size).toBe(CLASSES.length);
    for (const c of STATIC_RECEIVERS) {
      expect(c.doc).not.toBe("");
      expect(c.example).not.toBe("");
      for (const m of [...c.constructors, ...c.statics, ...c.instance]) {
        expect(m.doc, `${c.name}.${m.name}`).not.toBe("");
        expect(m.example, `${c.name}.${m.name}`).not.toBe("");
      }
    }
  });

  it("spot-checks a method, varargs, a constant and a field", () => {
    expect(findClass("Math")?.statics.find((m) => m.name === "max")).toMatchObject({ kind: "method", detail: "(int a, int b): int", returns: "int", insert: "max(${1:a}, ${2:b})" });
    expect(findStaticReceiver("System.out")?.statics.find((m) => m.name === "printf")).toMatchObject({ detail: "(String format, Object... werte): PrintStream", insert: "printf(${1:format}, ${2:werte})" });
    expect(findClass("Math")?.statics.find((m) => m.name === "PI")).toMatchObject({ kind: "constant", detail: ": double", insert: "PI" });
    expect(findClass("System")?.statics.find((m) => m.name === "out")).toMatchObject({ kind: "field", returns: "PrintStream" });
  });

  it("keeps overloaded constructors and placeholder constructor params", () => {
    const fw = findClass("FileWriter")!.constructors;
    expect(fw.map((c) => c.detail)).toEqual(["(String dateiname)", "(String dateiname, boolean anhaengen)"]);
    expect(findClass("Scanner")!.constructors[0]).toMatchObject({ params: "System.in", insert: "Scanner(${1:System.in})" });
  });

  // The shipped catalogue has no generic types yet (no ArrayList, Map, Files or Path); the parser cases for
  // generics with commas are covered in load.test.ts.
});
