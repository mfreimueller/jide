import { describe, expect, it } from "vitest";
import { cellSegments, diffNote, diffViewRows, failSummary, firstDiffIndex, hasLineDiff, inputLabel } from "./diff-view";

describe("inputLabel / failSummary", () => {
  it("shows line breaks as ⏎", () => {
    expect(inputLabel("3\n4\n")).toBe("3 ⏎ 4 ⏎");
    expect(inputLabel("3\r\n4")).toBe("3 ⏎ 4");
    expect(inputLabel("")).toBe("");
  });
  it("omits the input part when there is none", () => {
    expect(failSummary("3\n4\n")).toBe("Eingabe: 3 ⏎ 4 ⏎ · Ausgabe stimmt nicht");
    expect(failSummary("")).toBe("Ausgabe stimmt nicht");
    expect(failSummary(undefined)).toBe("Ausgabe stimmt nicht");
  });
});

describe("hasLineDiff / firstDiffIndex", () => {
  it("only failed results with a diff mode (old stored results and contains have none)", () => {
    expect(hasLineDiff({ status: "failed", match: "trimmed" })).toBe(true);
    expect(hasLineDiff({ status: "failed", match: "lines" })).toBe(true);
    expect(hasLineDiff({ status: "failed", match: "exact" })).toBe(true);
    expect(hasLineDiff({ status: "failed", match: "contains" })).toBe(false);
    expect(hasLineDiff({ status: "failed" })).toBe(false);
    expect(hasLineDiff({ status: "error", match: "trimmed" })).toBe(false);
    expect(
      firstDiffIndex([{ status: "passed" }, { status: "failed", match: "contains" }, { status: "failed", match: "trimmed" }])
    ).toBe(2);
    expect(firstDiffIndex([{ status: "passed" }])).toBe(-1);
  });
});

describe("cellSegments", () => {
  it("marks a range", () => {
    expect(cellSegments("abcde", [1, 3], false)).toEqual([
      { text: "a", kind: "plain" },
      { text: "bc", kind: "mark" },
      { text: "de", kind: "plain" },
    ]);
  });
  it("renders trailing whitespace as dots only when asked", () => {
    expect(cellSegments("a  ", null, true)).toEqual([
      { text: "a", kind: "plain" },
      { text: "··", kind: "ws" },
    ]);
    expect(cellSegments("a  ", null, false)).toEqual([{ text: "a  ", kind: "plain" }]);
    expect(cellSegments("", null, true)).toEqual([]);
  });
});

describe("diffViewRows", () => {
  it("screen 16: tags and the highlighted part of the expected line", () => {
    const rows = diffViewRows("Debug: a=3\nSumme: 7\nDurchschnitt: 3", "Summe: 7\nDurchschnitt: 3.5", "trimmed");
    expect(rows.map((r) => r.tag)).toEqual(["zu viel", "", "anders"]);
    expect(rows[2]!.expected).toEqual([
      { text: "Durchschnitt: 3", kind: "plain" },
      { text: ".5", kind: "mark" },
    ]);
    expect(rows[0]!.expected).toEqual([]);
  });
  it("exact shows trailing spaces", () => {
    const rows = diffViewRows("a \n", "a\n", "exact");
    expect(rows[0]!.actual).toEqual([
      { text: "a", kind: "plain" },
      { text: "·", kind: "ws" },
    ]);
  });
});

describe("diffNote", () => {
  it("differs for exact", () => {
    expect(diffNote("exact")).toBe("Hier muss die Ausgabe genau übereinstimmen.");
    expect(diffNote("trimmed")).toContain("3,5 und 3.5 gelten als gleich.");
    expect(diffNote("lines")).toContain("Leerzeilen");
  });
});
