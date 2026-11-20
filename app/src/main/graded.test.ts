import { describe, expect, it } from "vitest";
import type { Exercise, StudentGradeResponse } from "@jide/shared";
import { gradedExercise } from "./graded";

const ex = {
  id: "summe",
  title: "Summe",
  assignment: "# A",
  mainFile: "Main.java",
  files: [
    { path: "Main.java", editable: true },
    { path: "Hilfe.java", editable: false }
  ],
  originals: { "Main.java": "starter", "Hilfe.java": "hilfe" },
  images: [],
  imageContents: {}
} as unknown as Exercise;

const grade: StudentGradeResponse = {
  symbol: "MINUS",
  comment: "",
  gradedAt: "2026-11-16T09:00:00.000Z",
  handinId: 1,
  submittedAt: "2026-11-12T09:42:00.000Z",
  files: [
    { path: "Main.java", content: "abgegeben" },
    { path: "Hilfe.java", content: "manipuliert" },
    { path: "Fremd.java", content: "x" }
  ],
  lineComments: [{ path: "Main.java", line: 1, text: "t" }]
};

describe("gradedExercise", () => {
  it("opens the graded hand-in for editable files and the package for the rest", () => {
    const o = gradedExercise(ex, grade, null);
    expect(o.files).toEqual([
      { path: "Main.java", content: "abgegeben", editable: true },
      { path: "Hilfe.java", content: "hilfe", editable: false }
    ]);
    expect(o.graded).toMatchObject({ symbol: "MINUS", comment: "", submittedAt: grade.submittedAt, lineComments: grade.lineComments });
    expect(o.hasTests).toBe(false);
  });

  it("late = handed in after the deadline", () => {
    expect(gradedExercise(ex, grade, "2026-11-10T00:00:00.000Z").late).toBe(true);
    expect(gradedExercise(ex, grade, "2026-11-20T00:00:00.000Z").late).toBe(false);
  });
});
