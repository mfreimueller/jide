import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ExerciseError, loadExercise, matchOutput, parseTestsConfig } from "./index";

const examplesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../examples");

const VALID = `
tests:
  - name: "3 + 4"
    type: io
    input: "3\\n4\\n"
    expected: "7"
    match: contains
    timeout: 5s
  - name: io mit Defaults
    type: io
    expected: hallo
  - name: "summe(-2, 5)"
    type: check
    call: "summe(-2, 5)"
    expected: "3"
  - name: Person speichert Namen
    type: check
    timeout: 500ms
    code: |
      var p = new Person("Anna");
      return p.getName().equals("Anna");
`;

function err(yaml: string): string {
  try {
    parseTestsConfig(yaml, "x");
  } catch (e) {
    expect(e).toBeInstanceOf(ExerciseError);
    return (e as Error).message;
  }
  throw new Error("expected parseTestsConfig to throw");
}

const io = (extra = "") => `tests:\n  - name: a\n    type: io\n    expected: "1"\n${extra}`;
const check = (body: string) => `tests:\n  - name: a\n    type: check\n${body}`;

describe("parseTestsConfig", () => {
  it("parses all three shapes with defaults", () => {
    const t = parseTestsConfig(VALID, "x");
    expect(t).toEqual([
      { type: "io", name: "3 + 4", input: "3\n4\n", expected: "7", match: "contains", timeoutMs: 5000 },
      { type: "io", name: "io mit Defaults", input: "", expected: "hallo", match: "trimmed", timeoutMs: 2000 },
      { type: "check", name: "summe(-2, 5)", call: "summe(-2, 5)", expected: "3", timeoutMs: 2000 },
      {
        type: "check",
        name: "Person speichert Namen",
        code: 'var p = new Person("Anna");\nreturn p.getName().equals("Anna");\n',
        timeoutMs: 500,
      },
    ]);
  });

  it("converts numeric and boolean expected to strings", () => {
    const t = parseTestsConfig(
      "tests:\n  - {name: a, type: io, expected: 7}\n  - {name: b, type: check, call: f(), expected: true}\n  - {name: c, type: check, call: g(), expected: -2.5}\n",
    );
    expect(t.map((x) => ("expected" in x ? x.expected : undefined))).toEqual(["7", "true", "-2.5"]);
  });

  it("rejects text that is not YAML", () => {
    expect(err("tests: [unclosed\n")).toMatch(/^Aufgabe "x": tests\.yaml ist kein gültiges YAML \(.+\)\.$/);
  });

  it("rejects a missing tests key, a non-list and an empty list", () => {
    expect(err("foo: 1\n")).toMatch(/^Aufgabe "x": tests\.yaml ist ungültig: .*Unbekannter Schlüssel "foo"/);
    expect(err("")).toContain("tests.yaml ist ungültig");
    expect(err("tests: 5\n")).toBe('Aufgabe "x": tests.yaml ist ungültig: tests fehlt oder ist keine Liste (tests).');
    expect(err("tests: []\n")).toBe('Aufgabe "x": tests.yaml ist ungültig: tests darf nicht leer sein (tests).');
  });

  it("rejects missing or empty names", () => {
    expect(err("tests:\n  - type: io\n    expected: a\n")).toContain("name fehlt oder ist kein Text (tests.0.name)");
    expect(err('tests:\n  - name: " "\n    type: io\n    expected: a\n')).toContain("name darf nicht leer sein (tests.0.name)");
  });

  it("rejects duplicate names and names the duplicate", () => {
    const y = `tests:\n  - {name: A, type: io, expected: a}\n  - {name: A, type: io, expected: b}\n`;
    expect(err(y)).toBe('Aufgabe "x": tests.yaml ist ungültig: Testname "A" kommt doppelt vor.');
  });

  it("rejects unknown or missing type", () => {
    expect(err("tests:\n  - {name: a, type: unit, expected: a}\n")).toContain("type muss io oder check sein (tests.0.type)");
    expect(err("tests:\n  - {name: a, expected: a}\n")).toContain("type muss io oder check sein");
  });

  it("rejects unknown keys (typos)", () => {
    expect(err("tests:\n  - {name: a, type: io, exepcted: a}\n")).toContain('Unbekannter Schlüssel "exepcted" (tests.0)');
    expect(err(check("    call: f()\n    expected: 1\n    inpt: x\n"))).toContain('Unbekannter Schlüssel "inpt"');
  });

  it("rejects io without expected", () => {
    expect(err("tests:\n  - {name: a, type: io}\n")).toContain("expected fehlt oder ist kein Text, keine Zahl und kein true/false (tests.0.expected)");
  });

  it("rejects bad input and match values", () => {
    expect(err(io("    input: 5\n"))).toContain("input muss Text sein (tests.0.input)");
    expect(err(io("    match: regex\n"))).toContain("match muss exact, contains, trimmed oder lines sein (tests.0.match)");
  });

  it.each(["contains", "lines"])("rejects an empty expected with match: %s", (m) => {
    for (const e of ['""', '"  \\n "']) {
      expect(err(`tests:\n  - {name: a, type: io, expected: ${e}, match: ${m}}\n`)).toContain(
        "expected darf bei match: contains oder lines nicht leer sein (tests.0.expected)",
      );
    }
  });

  it.each(["trimmed", "exact"])("accepts an empty expected with match: %s", (m) => {
    expect(parseTestsConfig(`tests:\n  - {name: a, type: io, expected: "", match: ${m}}\n`)[0]).toMatchObject({ expected: "", match: m });
  });

  it("accepts match: lines", () => {
    expect(parseTestsConfig(io("    match: lines\n"))[0]).toMatchObject({ type: "io", match: "lines" });
  });

  it("checks the call/code/expected combinations of check tests", () => {
    expect(err(check("    call: f()\n    code: return true;\n    expected: 1\n"))).toContain("nicht call und code gleichzeitig");
    expect(err(check("    expected: 1\n"))).toContain("braucht call oder code");
    expect(err(check("    code: return true;\n    expected: 1\n"))).toContain("expected ist bei code nicht erlaubt (der Code gibt true oder false zurück) (tests.0.expected)");
    expect(err(check("    call: f()\n"))).toContain("expected fehlt (call braucht einen erwarteten Wert) (tests.0.expected)");
  });

  it("rejects match on check tests", () => {
    expect(err(check("    call: f()\n    expected: 1\n    match: exact\n"))).toContain("match gibt es nur bei Tests vom Typ io");
  });

  it.each(['"2"', "2", "abc", '"0s"', '"0ms"', '"31s"', '"30001ms"', '"-1s"', '"1.5s"', '""'])("rejects timeout %s", (v) => {
    expect(err(io(`    timeout: ${v}\n`))).toContain("timeout");
  });

  it.each([
    ['"500ms"', 500],
    ["2s", 2000],
    ["30s", 30000],
    ['"30000ms"', 30000],
    ["1ms", 1],
  ])("accepts timeout %s", (v, ms) => {
    expect(parseTestsConfig(io(`    timeout: ${v}\n`))[0]!.timeoutMs).toBe(ms);
  });
});

describe("matchOutput", () => {
  it("exact: equal after line-ending normalisation only", () => {
    expect(matchOutput("a\r\nb\rc", "a\nb\nc", "exact")).toBe(true);
    expect(matchOutput("a \n", "a\n", "exact")).toBe(false);
    expect(matchOutput("a\n", "a", "exact")).toBe(false);
    expect(matchOutput("a  b", "a b", "exact")).toBe(false);
  });

  it("trimmed: ignores trailing spaces, extra blank lines at the ends, collapsed spaces and CRLF", () => {
    expect(matchOutput("7", "7", "trimmed")).toBe(true);
    expect(matchOutput("\n\n  7  \r\n\r\n", "7", "trimmed")).toBe(true);
    expect(matchOutput("a   b\t\tc  \r\nd\t\r\n", "a b c\nd", "trimmed")).toBe(true);
    expect(matchOutput("Summe:  7\n", "Summe: 7", "trimmed")).toBe(true);
    expect(matchOutput("a\n\nb", "a\nb", "trimmed")).toBe(false);
    expect(matchOutput("Summe: 7", "7", "trimmed")).toBe(false);
    expect(matchOutput("7", "8", "trimmed")).toBe(false);
  });

  it("contains: normalised actual includes normalised expected", () => {
    expect(matchOutput("Erste Zahl: Zweite Zahl: Summe:  7 \r\n", "Summe: 7", "contains")).toBe(true);
    expect(matchOutput("Summe: 70", "Summe: 7", "contains")).toBe(true);
    expect(matchOutput("Summe: 8", "Summe: 7", "contains")).toBe(false);
    expect(matchOutput("a\nb\nc", "b\nc", "contains")).toBe(true);
    expect(matchOutput("x", "\n x \n", "contains")).toBe(true);
    // exact would have failed for the same input
    expect(matchOutput("Summe: 7\n", "Summe: 7", "exact")).toBe(false);
  });

  it("lines: expected lines appear as whole actual lines, in order", () => {
    const exp = "Summe: 7\nFertig";
    expect(matchOutput("Summe: 7\nFertig", exp, "lines")).toBe(true);
    // extra lines before, between and after
    expect(matchOutput("Zahl 1?\nZahl 2?\nSumme: 7\ndebug\nFertig\nbye", exp, "lines")).toBe(true);
    expect(matchOutput("Fertig\nSumme: 7", exp, "lines")).toBe(false); // wrong order
    expect(matchOutput("Summe: 7\n", exp, "lines")).toBe(false); // missing line
    expect(matchOutput("Summe: 7\nFertg", exp, "lines")).toBe(false); // typo
    expect(matchOutput("Summe: 7", "7", "lines")).toBe(false); // partial line
    expect(matchOutput("Summe: 7\r\n\r\nFertig\r\n", exp, "lines")).toBe(true); // CRLF, empty lines
    expect(matchOutput("  Summe:   7 \t\nFertig  ", exp, "lines")).toBe(true); // whitespace
    expect(matchOutput("a\nb", "a\n\nb", "lines")).toBe(true); // empty expected lines are skipped
    expect(matchOutput("a", "a\na", "lines")).toBe(false); // each expected line needs its own actual line
  });

  it("decimal rule: comma and dot between two digits are the same", () => {
    for (const mode of ["trimmed", "contains", "lines"] as const) {
      expect(matchOutput("Pi: 3,14", "Pi: 3.14", mode)).toBe(true);
      expect(matchOutput("Pi: 3.14", "Pi: 3,14", mode)).toBe(true);
      expect(matchOutput("1,2,3", "1.2.3", mode)).toBe(true);
      expect(matchOutput("[1, 2]", "[1,2]", mode)).toBe(false); // comma + space is not changed
      expect(matchOutput("a,b", "a.b", mode)).toBe(false); // not between digits
      expect(matchOutput("3,14", "3.15", mode)).toBe(false);
    }
    expect(matchOutput("3,14", "3.14", "exact")).toBe(false);
  });
});

describe("loadExercise with tests.yaml", () => {
  it("loads the sample tests", async () => {
    const summe = await loadExercise(path.join(examplesDir, "summe"));
    expect(summe.tests?.map((t) => t.type)).toEqual(["io", "io", "io"]);
    expect(summe.tests![0]).toMatchObject({ name: "3 + 4", input: "3\n4\n", expected: "Summe: 7", match: "contains" });
    const max = await loadExercise(path.join(examplesDir, "maximum"));
    expect(max.tests).toHaveLength(4);
    expect(max.tests![0]).toMatchObject({ type: "check", call: "maximum(3, 7)", expected: "7" });
  });

  async function make(testsYaml?: string): Promise<{ dir: string; cleanup: () => Promise<void> }> {
    const root = await mkdtemp(path.join(os.tmpdir(), "jide-tests-"));
    const dir = path.join(root, "t");
    await mkdir(path.join(dir, "files"), { recursive: true });
    await writeFile(path.join(dir, "exercise.yaml"), "id: t\ntitle: T\nfiles:\n  - path: A.java\nmainFile: A.java\n");
    await writeFile(path.join(dir, "aufgabe.md"), "# T");
    await writeFile(path.join(dir, "files", "A.java"), "class A {}");
    if (testsYaml !== undefined) await writeFile(path.join(dir, "tests.yaml"), testsYaml);
    return { dir, cleanup: () => rm(root, { recursive: true, force: true }) };
  }

  it("leaves tests undefined without a tests.yaml", async () => {
    const { dir, cleanup } = await make();
    try {
      expect((await loadExercise(dir)).tests).toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  it("throws for a broken tests.yaml", async () => {
    const { dir, cleanup } = await make("tests: []\n");
    try {
      await expect(loadExercise(dir)).rejects.toThrow('Aufgabe "t": tests.yaml ist ungültig: tests darf nicht leer sein (tests).');
    } finally {
      await cleanup();
    }
  });
});
