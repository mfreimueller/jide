import { describe, expect, it } from "vitest";
import { commentCounts, type GradeSymbol, feedbackDate, GRADE_TEXT, gradeSubtitle, gradeTone, placeComments } from "./grade";

const GRADE_SYMBOLS: GradeSymbol[] = ["PLUS", "PLUS_WELLE", "WELLE", "MINUS_WELLE", "MINUS"];

describe("grade symbols", () => {
  it("shows + +~ ~ −~ − (real minus sign) for every symbol", () => {
    expect(GRADE_SYMBOLS.map((s) => GRADE_TEXT[s])).toEqual(["+", "+~", "~", "−~", "−"]);
  });

  it("colours: + and +~ green, ~ amber, −~ and − red", () => {
    expect(GRADE_SYMBOLS.map(gradeTone)).toEqual(["good", "good", "mid", "bad", "bad"]);
  });
});

describe("texts", () => {
  const at = "2026-11-16T09:00:00.000Z"; // Mo, 16.11. in Vienna

  it("subtitle with comments, singular, none and unknown", () => {
    expect(gradeSubtitle(at, 2)).toBe("Beurteilt am Mo, 16.11. · 2 Kommentare");
    expect(gradeSubtitle(at, 1)).toBe("Beurteilt am Mo, 16.11. · 1 Kommentar");
    expect(gradeSubtitle(at, 0)).toBe("Beurteilt am Mo, 16.11.");
    expect(gradeSubtitle(at)).toBe("Beurteilt am Mo, 16.11.");
  });

  it("feedback date", () => {
    expect(feedbackDate(at)).toBe("beurteilt am Mo, 16.11.");
  });
});

describe("line comments", () => {
  const c = (path: string, line: number, text: string) => ({ path, line, text });

  it("places the comments of one file after their lines, in order", () => {
    const all = [c("A.java", 7, "sieben"), c("B.java", 1, "fremd"), c("A.java", 4, "vier"), c("A.java", 4, "vier b")];
    expect(placeComments(all, "A.java", 8)).toEqual([
      { afterLine: 4, text: "vier" },
      { afterLine: 4, text: "vier b" },
      { afterLine: 7, text: "sieben" }
    ]);
  });

  it("a line beyond the end of the file goes after the last line", () => {
    expect(placeComments([c("A.java", 99, "x"), c("A.java", 3, "y")], "A.java", 5)).toEqual([
      { afterLine: 3, text: "y" },
      { afterLine: 5, text: "x" }
    ]);
    expect(placeComments([c("A.java", 2, "x")], "A.java", 0)).toEqual([{ afterLine: 1, text: "x" }]);
    expect(placeComments([c("A.java", 0, "x")], "A.java", 5)).toEqual([{ afterLine: 5, text: "x" }]);
  });

  it("counts comments per file", () => {
    const counts = commentCounts([c("A.java", 1, ""), c("A.java", 2, ""), c("B.java", 1, "")]);
    expect([...counts]).toEqual([["A.java", 2], ["B.java", 1]]);
  });
});
