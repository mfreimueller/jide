import { describe, expect, it } from "vitest";
import type { ExerciseSummary } from "./api";
import { sectionExercises } from "./grouping";

const ex = (id: string, groupId: number | null, status: ExerciseSummary["status"] = "neu"): ExerciseSummary => ({
  id,
  title: id,
  status,
  deadline: null,
  submittedAt: null,
  late: false,
  groupId,
  kind: null
});
const ids = (s: { exercises: ExerciseSummary[] }) => s.exercises.map((e) => e.id);

describe("sectionExercises", () => {
  it("without groups: one plain list, open before handed in, no headings", () => {
    const r = sectionExercises([ex("a", null, "abgegeben"), ex("b", null), ex("c", null, "in-arbeit")], []);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ title: null, progress: null });
    expect(ids(r[0]!)).toEqual(["b", "c", "a"]);
  });

  it("inside a group: open and handed-in parts each keep the incoming order", () => {
    const list = [ex("h1", 1, "abgegeben"), ex("o1", 1), ex("h2", 1, "abgegeben"), ex("o2", 1, "in-arbeit"), ex("o3", 1)];
    const r = sectionExercises(list, [{ id: 1, name: "G" }]);
    expect(ids(r[0]!)).toEqual(["o1", "o2", "o3", "h1", "h2"]);
    expect(r[0]!.progress).toBe("2 / 5 abgegeben");
  });

  it("is empty for an empty list", () => {
    expect(sectionExercises([], [{ id: 1, name: "X" }])).toEqual([]);
  });

  it("keeps the incoming order of groups, puts open exercises first inside, with progress", () => {
    const groups = [
      { id: 2, name: "Arrays" },
      { id: 1, name: "Schleifen" }
    ];
    const list = [ex("a1", 2, "abgegeben"), ex("a2", 2), ex("s1", 1, "abgegeben"), ex("s2", 1, "abgegeben")];
    const r = sectionExercises(list, groups);
    expect(r.map((s) => [s.title, s.progress])).toEqual([
      ["Arrays", "1 / 2 abgegeben"],
      ["Schleifen", "2 / 2 abgegeben"]
    ]);
    expect(ids(r[0]!)).toEqual(["a2", "a1"]); // open first
    expect(ids(r[1]!)).toEqual(["s1", "s2"]); // all handed in: incoming order
  });

  it("puts ungrouped exercises last under Weitere Übungen, open first, without progress", () => {
    const r = sectionExercises([ex("x", null, "abgegeben"), ex("g", 1), ex("y", null)], [{ id: 1, name: "G" }]);
    expect(r.map((s) => s.title)).toEqual(["G", "Weitere Übungen"]);
    expect(r[1]!.progress).toBeNull();
    expect(ids(r[1]!)).toEqual(["y", "x"]);
  });

  it("leaves out groups without visible exercises; if none is left the list is plain", () => {
    const r = sectionExercises([ex("x", null)], [{ id: 1, name: "Leer" }]);
    expect(r).toHaveLength(1);
    expect(r[0]!.title).toBeNull();
  });

  it("treats an exercise of an unknown group like an ungrouped one", () => {
    const r = sectionExercises([ex("a", 9), ex("b", 1)], [{ id: 1, name: "G" }]);
    expect(r.map((s) => s.title)).toEqual(["G", "Weitere Übungen"]);
    expect(ids(r[1]!)).toEqual(["a"]);
  });
});
