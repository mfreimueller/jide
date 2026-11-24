import { beforeEach, describe, expect, it } from "vitest";
import {
  allPassed,
  clearLastTests,
  countLabel,
  editableContents,
  handInReason,
  isStale,
  normalizeForCompare,
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

describe("normalizeForCompare", () => {
  it("unifies line endings and drops trailing whitespace and trailing blank lines only", () => {
    expect(normalizeForCompare("a \t\r\n\r\n b\r\r")).toBe("a\n\n b");
    expect(normalizeForCompare("  a\n\nb")).toBe("  a\n\nb");
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

describe("isStale / handInReason", () => {
  const green: LastTest = { ...last, summary: { passed: 2, total: 2 } };
  const same = [{ path: "A.java", content: "x" }];

  it("is never stale without a run", () => {
    expect(isStale(undefined, same)).toBe(false);
  });
  it("is not stale for whitespace-only edits at line or file ends", () => {
    expect(isStale(green, same)).toBe(false);
    expect(isStale(green, [{ path: "A.java", content: "x " }])).toBe(false);
    expect(isStale(green, [{ path: "A.java", content: "x\t" }])).toBe(false);
    expect(isStale(green, [{ path: "A.java", content: "x\r\n" }])).toBe(false);
    expect(isStale(green, [{ path: "A.java", content: "x\n\n  \n" }])).toBe(false);
  });
  it("is stale when content or indentation differs, a blank line is added inside, or a file came or went", () => {
    const two: LastTest = { ...green, snapshot: [{ path: "A.java", content: "a\nb" }] };
    expect(isStale(green, [{ path: "A.java", content: "y" }])).toBe(true);
    expect(isStale(two, [{ path: "A.java", content: "a\n\nb" }])).toBe(true);
    expect(isStale(two, [{ path: "A.java", content: "a\n b" }])).toBe(true);
    expect(isStale(two, [{ path: "A.java", content: " a\nb" }])).toBe(true);
    expect(isStale(green, [...same, { path: "B.java", content: "" }])).toBe(true);
    expect(isStale(green, [])).toBe(true);
  });
  it("names the reason the hand-in asks or not", () => {
    expect(handInReason(false, undefined, same)).toBe("no-tests");
    expect(handInReason(true, undefined, same)).toBe("never-tested");
    expect(handInReason(true, last, same)).toBe("failed");
    expect(handInReason(true, green, [{ path: "A.java", content: "y" }])).toBe("changed");
    expect(handInReason(true, last, [{ path: "A.java", content: "y" }])).toBe("changed");
    expect(handInReason(true, green, same)).toBe("ok");
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
  it("does not ask after a green run with only trailing whitespace added", () => {
    expect(planHandIn(true, green, [{ path: "A.java", content: "x \n\n" }])).toEqual({ confirm: false, summary: { passed: 2, total: 2 } });
  });
  it("asks after a green run when the code changed, without summary", () => {
    expect(planHandIn(true, green, edited)).toEqual({ confirm: true, summary: null });
  });
  it("asks after a failed run, sending the summary only if the code is unchanged", () => {
    expect(planHandIn(true, last, same)).toEqual({ confirm: true, summary: { passed: 1, total: 2 } });
    expect(planHandIn(true, last, edited)).toEqual({ confirm: true, summary: null });
  });
});
