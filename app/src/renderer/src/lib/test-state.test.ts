import { beforeEach, describe, expect, it } from "vitest";
import {
  allPassed,
  clearLastTests,
  countLabel,
  editableContents,
  planHandIn,
  getLastTest,
  sameContents,
  setLastTest,
  type LastTest
} from "./test-state";

const last: LastTest = {
  results: [],
  summary: { passed: 1, total: 2 },
  snapshot: [{ path: "A.java", content: "x" }],
  at: "2026-11-01T10:00:00Z"
};

describe("last test per exercise", () => {
  beforeEach(clearLastTests);

  it("keeps one result per exercise", () => {
    setLastTest("summe", last);
    expect(getLastTest("summe")).toBe(last);
    expect(getLastTest("maximum")).toBeUndefined();
    const newer = { ...last, summary: { passed: 2, total: 2 } };
    setLastTest("summe", newer);
    expect(getLastTest("summe")).toBe(newer);
  });
});

describe("snapshots", () => {
  const files = [
    { path: "A.java", content: "", editable: true },
    { path: "Hilfe.java", content: "", editable: false }
  ];

  it("keeps only editable files", () => {
    const contents = [
      { path: "A.java", content: "a" },
      { path: "Hilfe.java", content: "h" }
    ];
    expect(editableContents(files, contents)).toEqual([{ path: "A.java", content: "a" }]);
  });

  it("compares by path and content, in any order", () => {
    const a = [
      { path: "A.java", content: "1" },
      { path: "B.java", content: "2" }
    ];
    expect(sameContents(a, [a[1]!, a[0]!])).toBe(true);
    expect(sameContents(a, [a[0]!, { path: "B.java", content: "3" }])).toBe(false);
    expect(sameContents(a, [a[0]!])).toBe(false);
  });
});

describe("summary helpers", () => {
  it("all passed needs at least one test", () => {
    expect(allPassed({ passed: 3, total: 3 })).toBe(true);
    expect(allPassed({ passed: 2, total: 3 })).toBe(false);
    expect(allPassed({ passed: 0, total: 0 })).toBe(false);
  });
  it("labels the count in German", () => {
    expect(countLabel({ passed: 3, total: 4 })).toBe("3 von 4 Tests bestanden");
  });
});

describe("planHandIn", () => {
  const green: LastTest = { ...last, summary: { passed: 2, total: 2 } };
  const same = [{ path: "A.java", content: "x" }];
  const edited = [{ path: "A.java", content: "y" }];

  it("never asks without tests", () => {
    expect(planHandIn(false, undefined, same)).toEqual({ confirm: false, summary: null });
    expect(planHandIn(false, green, same)).toEqual({ confirm: false, summary: null });
  });
  it("asks when never tested", () => {
    expect(planHandIn(true, undefined, same)).toEqual({ confirm: true, summary: null });
  });
  it("does not ask after a green run on unchanged files and sends the summary", () => {
    expect(planHandIn(true, green, same)).toEqual({ confirm: false, summary: { passed: 2, total: 2 } });
  });
  it("asks after a green run when the code changed, without summary", () => {
    expect(planHandIn(true, green, edited)).toEqual({ confirm: true, summary: null });
  });
  it("asks after a failed run, sending the summary only if the code is unchanged", () => {
    expect(planHandIn(true, last, same)).toEqual({ confirm: true, summary: { passed: 1, total: 2 } });
    expect(planHandIn(true, last, edited)).toEqual({ confirm: true, summary: null });
  });
});
