import { describe, expect, it } from "vitest";
import type { Diagnostic } from "../../../shared-types/api";
import {
  SEVERITY_ERROR,
  SEVERITY_WARNING,
  errorCount,
  errorCountByFile,
  locationLabel,
  markersByFile,
  toMarker
} from "./diagnostics";

function diag(over: Partial<Diagnostic> = {}): Diagnostic {
  return {
    file: "Summe.java",
    line: 7,
    column: 14,
    endLine: 7,
    endColumn: 15,
    severity: "error",
    message: "';' erwartet",
    origin: "student",
    ...over
  };
}

describe("toMarker", () => {
  it("maps position and severity 1:1 (columns are already 1-based UTF-16)", () => {
    expect(toMarker(diag())).toEqual({
      severity: SEVERITY_ERROR,
      message: "';' erwartet",
      startLineNumber: 7,
      startColumn: 14,
      endLineNumber: 7,
      endColumn: 15
    });
  });

  it("maps warnings", () => {
    expect(toMarker(diag({ severity: "warning" }))?.severity).toBe(SEVERITY_WARNING);
  });

  it("falls back to a one character range when the end is missing", () => {
    const m = toMarker(diag({ endLine: null, endColumn: null }));
    expect([m?.endLineNumber, m?.endColumn]).toEqual([7, 15]);
  });

  it("has no marker for general errors or errors without a line", () => {
    expect(toMarker(diag({ file: null, line: null }))).toBeUndefined();
    expect(toMarker(diag({ line: null }))).toBeUndefined();
  });
});

describe("grouping", () => {
  const list = [
    diag(),
    diag({ line: 9, message: "zweiter" }),
    diag({ file: "Person.java", severity: "warning" }),
    diag({ file: null, line: null })
  ];

  it("groups markers per file", () => {
    const by = markersByFile(list);
    expect([...by.keys()]).toEqual(["Summe.java", "Person.java"]);
    expect(by.get("Summe.java")).toHaveLength(2);
  });

  it("counts errors, not warnings", () => {
    expect(errorCount(list)).toBe(3);
    expect(errorCountByFile(list)).toEqual(new Map([["Summe.java", 2]]));
  });
});

describe("locationLabel", () => {
  it("formats file and line", () => {
    expect(locationLabel(diag())).toBe("Summe.java:7");
    expect(locationLabel(diag({ line: null }))).toBe("Summe.java");
    expect(locationLabel(diag({ file: null, line: null }))).toBe("");
  });
});
