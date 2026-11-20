import { describe, expect, it } from "vitest";
import { AUTO_HIDE_MS, cleanModes, hiddenCount, hiddenExercises, hiddenState, hiddenSubtitle, isHidden, mayHide } from "./hiding";
import type { ExerciseSummary } from "./api";

const NOW = new Date("2026-11-20T12:00:00Z");
function ex(over: Partial<ExerciseSummary> = {}): ExerciseSummary {
  return { id: "a", title: "A", status: "neu", deadline: null, submittedAt: null, late: false, groupId: null, difficulty: null, ...over };
}
const gradedAgo = (ms: number): Partial<ExerciseSummary> => ({
  status: "abgegeben",
  grade: { symbol: "PLUS", gradedAt: new Date(NOW.getTime() - ms).toISOString() }
});

describe("mayHide", () => {
  it("open exercise: no", () => expect(mayHide(ex(), NOW)).toBe(false));
  it("in progress with a future deadline: no", () => expect(mayHide(ex({ status: "in-arbeit", deadline: "2026-12-01T00:00:00Z" }), NOW)).toBe(false));
  it("handed in: yes", () => expect(mayHide(ex({ status: "abgegeben", submittedAt: "2026-11-01T00:00:00Z" }), NOW)).toBe(true));
  it("handed in once (submittedAt) even if status says otherwise: yes", () => expect(mayHide(ex({ submittedAt: "2026-11-01T00:00:00Z" }), NOW)).toBe(true));
  it("graded: yes", () => expect(mayHide(ex(gradedAgo(1000)), NOW)).toBe(true));
  it("deadline passed: yes", () => expect(mayHide(ex({ deadline: "2026-11-19T00:00:00Z" }), NOW)).toBe(true));
  it("Scratch: never", () => expect(mayHide(ex({ scratch: true, status: "abgegeben" }), NOW)).toBe(false));
});

describe("isHidden", () => {
  it("not graded, no choice: shown", () => expect(isHidden(ex({ status: "abgegeben" }), undefined, NOW)).toBe(false));
  it("graded 7 days ago exactly: hidden", () => expect(isHidden(ex(gradedAgo(AUTO_HIDE_MS)), undefined, NOW)).toBe(true));
  it("graded 7 days minus 1 ms ago: shown", () => expect(isHidden(ex(gradedAgo(AUTO_HIDE_MS - 1)), undefined, NOW)).toBe(false));
  it("shown overrides the automatic rule", () => expect(isHidden(ex(gradedAgo(AUTO_HIDE_MS * 3)), "shown", NOW)).toBe(false));
  it("hidden wins right after grading", () => expect(isHidden(ex(gradedAgo(1000)), "hidden", NOW)).toBe(true));
  it("hidden on a handed-in exercise", () => expect(isHidden(ex({ status: "abgegeben" }), "hidden", NOW)).toBe(true));
  it("Scratch is never hidden", () => expect(isHidden(ex({ scratch: true }), "hidden", NOW)).toBe(false));
  it("broken gradedAt: not hidden automatically", () => expect(isHidden(ex({ grade: { symbol: "PLUS", gradedAt: "x" } }), undefined, NOW)).toBe(false));
});

describe("hiddenExercises", () => {
  it("keeps the list order", () => {
    const list = [ex({ id: "c" }), ex({ id: "b" }), ex({ id: "a" })];
    expect(hiddenExercises(list, { a: "hidden", c: "hidden" }, NOW).map((e) => e.id)).toEqual(["c", "a"]);
  });
});

describe("texts", () => {
  it("graded", () => expect(hiddenState(ex({ grade: { symbol: "PLUS_WELLE", gradedAt: "2026-11-16T10:00:00Z" } }))).toEqual({ kind: "graded", text: "beurteilt Mo, 16.11." }));
  it("handed in", () => expect(hiddenState(ex({ status: "abgegeben", submittedAt: "2026-10-30T10:00:00Z" }))).toEqual({ kind: "handed-in", text: "abgegeben Fr, 30.10." }));
  it("past deadline", () => expect(hiddenState(ex({ deadline: "2020-10-26T10:00:00Z" }))).toEqual({ kind: "late", text: "Frist vorbei Mo, 26.10." }));
  it("subtitle with group and without", () => {
    const e = ex({ groupId: 1, status: "abgegeben", submittedAt: "2026-10-30T10:00:00Z" });
    expect(hiddenSubtitle(e, [{ id: 1, name: "Variablen" }])).toBe("Variablen · abgegeben Fr, 30.10.");
    expect(hiddenSubtitle(e, [])).toBe("Weitere Übungen · abgegeben Fr, 30.10.");
  });
  it("count", () => {
    expect(hiddenCount(1)).toBe("1 Aufgabe");
    expect(hiddenCount(5)).toBe("5 Aufgaben");
  });
});

describe("cleanModes", () => {
  it("drops junk", () => expect(cleanModes({ a: "hidden", b: "x", c: "shown", d: 1 })).toEqual({ a: "hidden", c: "shown" }));
  it("non-objects", () => expect(cleanModes(null)).toEqual({}));
});
