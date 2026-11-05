import { describe, expect, it } from "vitest";
import { diffOutput, matchOutput, splitDifference, type DiffMode } from "./index";

const kinds = (rows: { kind: string }[]) => rows.map((r) => r.kind);

describe("diffOutput", () => {
  it("equal lines only", () => {
    const rows = diffOutput("a\nb\n", "a\nb", "trimmed");
    expect(rows).toEqual([
      { kind: "equal", expected: "a", actual: "a" },
      { kind: "equal", expected: "b", actual: "b" },
    ]);
  });

  it("extra lines before, between and after", () => {
    expect(kinds(diffOutput("x\na\ny\nb\nz", "a\nb", "trimmed"))).toEqual(["extra", "equal", "extra", "equal", "extra"]);
  });

  it("missing lines", () => {
    const rows = diffOutput("a\nc", "a\nb\nc", "trimmed");
    expect(rows).toEqual([
      { kind: "equal", expected: "a", actual: "a" },
      { kind: "missing", expected: "b" },
      { kind: "equal", expected: "c", actual: "c" },
    ]);
  });

  it("pairs a missing and an extra line at the same spot into different", () => {
    expect(diffOutput("a\nX\nc", "a\nb\nc", "trimmed")[1]).toEqual({ kind: "different", expected: "b", actual: "X" });
  });

  it("pairs in order and leaves the rest missing or extra", () => {
    expect(diffOutput("a\nX", "a\nb\nc\nd", "trimmed")).toEqual([
      { kind: "equal", expected: "a", actual: "a" },
      { kind: "different", expected: "b", actual: "X" },
      { kind: "missing", expected: "c" },
      { kind: "missing", expected: "d" },
    ]);
    expect(kinds(diffOutput("a\nX\nY\nZ", "a\nb", "trimmed"))).toEqual(["equal", "different", "extra", "extra"]);
  });

  it("screen 16 example: extra, equal, different", () => {
    const rows = diffOutput("Debug: a=3\nSumme: 7\nDurchschnitt: 3", "Summe: 7\nDurchschnitt: 3.5", "trimmed");
    expect(rows).toEqual([
      { kind: "extra", actual: "Debug: a=3" },
      { kind: "equal", expected: "Summe: 7", actual: "Summe: 7" },
      { kind: "different", expected: "Durchschnitt: 3.5", actual: "Durchschnitt: 3" },
    ]);
  });

  it("trimmed ignores whitespace, empty lines and the decimal separator", () => {
    const rows = diffOutput("Wert:   3,5  \n\n\nEnde\n", "Wert: 3.5\nEnde", "trimmed");
    expect(kinds(rows)).toEqual(["equal", "equal"]);
  });

  it("handles CRLF", () => {
    expect(kinds(diffOutput("a\r\nb\r\n", "a\nb", "trimmed"))).toEqual(["equal", "equal"]);
    expect(kinds(diffOutput("a\r\nb", "a\nb", "exact"))).toEqual(["equal", "equal"]);
  });

  it("exact keeps whitespace, empty lines and decimal separators", () => {
    expect(diffOutput("a \nb", "a\nb", "exact")[0]).toEqual({ kind: "different", expected: "a", actual: "a " });
    expect(diffOutput("a\n", "a", "exact")).toEqual([
      { kind: "equal", expected: "a", actual: "a" },
      { kind: "extra", actual: "" },
    ]);
    expect(diffOutput("3,5", "3.5", "exact")[0]!.kind).toBe("different");
  });

  it("exact: empty expected against output", () => {
    expect(diffOutput("x", "", "exact")).toEqual([{ kind: "extra", actual: "x" }]);
  });

  it("lines: ignored output lines, missing expected lines", () => {
    expect(kinds(diffOutput("dbg\nA\ndbg2\nB\ndbg3", "A\nB", "lines"))).toEqual([
      "ignored",
      "equal",
      "ignored",
      "equal",
      "ignored",
    ]);
    const rows = diffOutput("A\nC", "A\nB\nC", "lines");
    expect(rows).toEqual([
      { kind: "equal", expected: "A", actual: "A" },
      { kind: "missing", expected: "B" },
      { kind: "equal", expected: "C", actual: "C" },
    ]);
    expect(diffOutput("dbg", "A", "lines")).toEqual([
      { kind: "missing", expected: "A" },
      { kind: "ignored", actual: "dbg" },
    ]);
  });

  it("lines: wrong order shows a missing line", () => {
    expect(kinds(diffOutput("B\nA", "A\nB", "lines"))).toContain("missing");
  });

  it("huge unmatched blocks fall back without building the table", () => {
    const e = Array.from({ length: 3000 }, (_, i) => `e${i}`).join("\n");
    const a = Array.from({ length: 3000 }, (_, i) => `a${i}`).join("\n");
    const rows = diffOutput(a, e, "trimmed");
    expect(rows).toHaveLength(3000);
    expect(rows.every((r) => r.kind === "different")).toBe(true);
  });

  const samples: [string, string][] = [
    ["a\nb", "a\nb"],
    ["a\r\nb\r\n", "a\nb"],
    ["dbg\na\nb\nx", "a\nb"],
    ["a  b \n\n c", "a b\nc"],
    ["Summe: 3,5", "Summe: 3.5"],
    ["", ""],
    ["a", "b"],
    ["a\n", "a"],
    ["a \nb", "a\nb"],
    ["x\ny", "x\nz\ny"],
  ];
  for (const mode of ["exact", "trimmed", "lines"] as DiffMode[]) {
    it(`is consistent with matchOutput (${mode})`, () => {
      for (const [actual, expected] of samples) {
        const rows = diffOutput(actual, expected, mode);
        const bad = rows.some((r) => r.kind === "extra" || r.kind === "missing" || r.kind === "different");
        expect(bad, `${mode}: ${JSON.stringify([actual, expected])}`).toBe(!matchOutput(actual, expected, mode));
      }
    });
  }
});

describe("splitDifference", () => {
  it("keeps common start and end, marks the middle", () => {
    expect(splitDifference("Durchschnitt: 3.5", "Durchschnitt: 3")).toEqual({ prefix: "Durchschnitt: 3", middle: ".5", suffix: "" });
    expect(splitDifference("abcXdef", "abcYdef")).toEqual({ prefix: "abc", middle: "X", suffix: "def" });
    expect(splitDifference("aa", "aaa")).toEqual({ prefix: "aa", middle: "", suffix: "" });
    expect(splitDifference("x", "")).toEqual({ prefix: "", middle: "x", suffix: "" });
  });
});
