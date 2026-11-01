import { describe, expect, it } from "vitest";
import { parseTestSummary } from "./test-summary";

describe("parseTestSummary", () => {
  it("accepts passed <= total", () => {
    expect(parseTestSummary({ passed: 3, total: 5 })).toEqual({ passed: 3, total: 5 });
    expect(parseTestSummary({ passed: 0, total: 1, extra: 1 })).toEqual({ passed: 0, total: 1 });
  });
  it("rejects everything else as null", () => {
    for (const v of [null, undefined, "x", {}, { passed: 1 }, { passed: 2, total: 1 }, { passed: -1, total: 1 }, { passed: 0, total: 0 }, { passed: 1.5, total: 2 }, { passed: "1", total: 2 }]) {
      expect(parseTestSummary(v)).toBeNull();
    }
  });
});
