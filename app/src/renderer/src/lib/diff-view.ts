/** Pure helpers for the line diff in the Tests panel (T34). */
// Subpath import: the package root also holds Node-only code (files, yaml) that must not end up in the renderer.
import { diffOutput, splitDifference, type DiffMode, type DiffRow } from "@jide/shared/output-diff";

export type DiffSegmentKind = "plain" | "mark" | "ws";
export interface DiffSegment {
  text: string;
  kind: DiffSegmentKind;
}

export const MSG_NOTE_NORMALISED =
  "Leerzeichen am Zeilenende und Leerzeilen werden nicht verglichen. 3,5 und 3.5 gelten als gleich.";
export const MSG_NOTE_EXACT = "Hier muss die Ausgabe genau übereinstimmen.";
export const MSG_NOTE_CONTAINS = "Dieser Text kommt in deiner Ausgabe nicht vor.";

export function diffNote(mode: DiffMode): string {
  return mode === "exact" ? MSG_NOTE_EXACT : MSG_NOTE_NORMALISED;
}

/** `3 ⏎ 4 ⏎` for "3\n4\n"; empty for an empty input. */
export function inputLabel(input: string): string {
  return input
    .replace(/\r\n?|\n/g, " ⏎ ")
    .replace(/[ \t]+$/, "")
    .trim();
}

/** The grey summary after the test name. */
export function failSummary(input: string | undefined): string {
  const label = inputLabel(input ?? "");
  return label === "" ? "Ausgabe stimmt nicht" : `Eingabe: ${label} · Ausgabe stimmt nicht`;
}

/** Index of the first failed io test that gets a line diff (it is open by default), or -1. */
export function firstDiffIndex(results: { status: string; match?: string; input?: string }[]): number {
  return results.findIndex((r) => hasLineDiff(r));
}

/** True for failed io results of a new run with a mode that has a line diff (not `contains`, not old results). */
export function hasLineDiff(r: { status: string; match?: string }): r is { status: string; match: DiffMode } {
  return r.status === "failed" && (r.match === "exact" || r.match === "trimmed" || r.match === "lines");
}

/**
 * Cuts one cell text into styled pieces. `mark` bolds a [start, end) range (characters that differ);
 * `showTrailingWs` renders whitespace at the end of the line as grey dots (exact mode).
 */
export function cellSegments(text: string, mark: [number, number] | null, showTrailingWs: boolean): DiffSegment[] {
  const len = text.length;
  const wsStart = showTrailingWs ? len - (/[ \t]*$/.exec(text)![0].length) : len;
  const cuts = new Set<number>([0, len, wsStart]);
  if (mark && mark[1] > mark[0]) {
    cuts.add(mark[0]);
    cuts.add(mark[1]);
  }
  const points = [...cuts].filter((p) => p >= 0 && p <= len).sort((a, b) => a - b);
  const out: DiffSegment[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const [from, to] = [points[i]!, points[i + 1]!];
    const part = text.slice(from, to);
    if (from >= wsStart) out.push({ text: part.replace(/ /g, "·").replace(/\t/g, "→"), kind: "ws" });
    else out.push({ text: part, kind: mark && from >= mark[0] && to <= mark[1] ? "mark" : "plain" });
  }
  return out;
}

export interface DiffViewRow {
  kind: DiffRow["kind"];
  expected: DiffSegment[];
  actual: DiffSegment[];
  tag: string;
}

const TAGS: Record<DiffRow["kind"], string> = {
  equal: "",
  extra: "zu viel",
  missing: "fehlt",
  different: "anders",
  ignored: "ignoriert",
};

/** The rows of the diff block, ready to draw. */
export function diffViewRows(actual: string, expected: string, mode: DiffMode): DiffViewRow[] {
  const exact = mode === "exact";
  return diffOutput(actual, expected, mode).map((row) => {
    let mark: [number, number] | null = null;
    if (row.kind === "different") {
      const d = splitDifference(row.expected ?? "", row.actual ?? "");
      mark = [d.prefix.length, d.prefix.length + d.middle.length];
    }
    return {
      kind: row.kind,
      expected: row.expected === undefined ? [] : cellSegments(row.expected, mark, exact),
      actual: row.actual === undefined ? [] : cellSegments(row.actual, null, exact),
      tag: TAGS[row.kind],
    };
  });
}
