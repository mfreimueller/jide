import { normaliseNewlines, normaliseNumeric } from "./output-normalise.js";

/** The modes that get a line diff; `contains` has none (it is a substring test). */
export type DiffMode = "exact" | "trimmed" | "lines";

export interface DiffRow {
  /**
   * equal: same line on both sides. extra: only in the output. missing: only expected.
   * different: a missing and an extra line at the same spot (both fields set).
   * ignored: output line that `lines` does not need (only `actual` set).
   */
  kind: "equal" | "extra" | "missing" | "different" | "ignored";
  expected?: string;
  actual?: string;
}

/** Above this many cells the LCS table is skipped (huge outputs); the unmatched middle is then shown as one changed block. */
const MAX_LCS_CELLS = 4_000_000;

/**
 * Splits text into the lines that are compared in `mode` (the same normalisation as matchOutput).
 * exact: only line endings are normalised. trimmed/lines: whitespace and decimal separators are normalised and empty lines dropped.
 */
function comparedLines(s: string, mode: DiffMode): string[] {
  if (mode === "exact") return s === "" ? [] : normaliseNewlines(s).split("\n");
  return normaliseNumeric(s)
    .split("\n")
    .filter((l) => l !== "");
}

type Op = { op: "equal" | "missing" | "extra"; text: string };

/** Line diff via longest common subsequence; common head and tail are peeled off first. */
function lcsOps(expected: string[], actual: string[]): Op[] {
  let head = 0;
  while (head < expected.length && head < actual.length && expected[head] === actual[head]) head++;
  let tail = 0;
  while (
    tail < expected.length - head &&
    tail < actual.length - head &&
    expected[expected.length - 1 - tail] === actual[actual.length - 1 - tail]
  ) {
    tail++;
  }
  const e = expected.slice(head, expected.length - tail);
  const a = actual.slice(head, actual.length - tail);

  const ops: Op[] = expected.slice(0, head).map((text) => ({ op: "equal", text }));
  if ((e.length + 1) * (a.length + 1) > MAX_LCS_CELLS) {
    for (const text of e) ops.push({ op: "missing", text });
    for (const text of a) ops.push({ op: "extra", text });
  } else {
    // table[i][j]: LCS length of e[i..] and a[j..]
    const w = a.length + 1;
    const table = new Uint32Array((e.length + 1) * w);
    for (let i = e.length - 1; i >= 0; i--) {
      for (let j = a.length - 1; j >= 0; j--) {
        table[i * w + j] =
          e[i] === a[j] ? table[(i + 1) * w + j + 1]! + 1 : Math.max(table[(i + 1) * w + j]!, table[i * w + j + 1]!);
      }
    }
    let i = 0;
    let j = 0;
    while (i < e.length || j < a.length) {
      if (i < e.length && j < a.length && e[i] === a[j]) {
        ops.push({ op: "equal", text: e[i]! });
        i++;
        j++;
      } else if (j >= a.length || (i < e.length && table[(i + 1) * w + j]! >= table[i * w + j + 1]!)) {
        ops.push({ op: "missing", text: e[i]! });
        i++;
      } else {
        ops.push({ op: "extra", text: a[j]! });
        j++;
      }
    }
  }
  for (const text of expected.slice(expected.length - tail)) ops.push({ op: "equal", text });
  return ops;
}

/** Within each run of non-equal ops, pairs missing and extra lines in order into `different` rows. */
function toRows(ops: Op[]): DiffRow[] {
  const rows: DiffRow[] = [];
  let i = 0;
  while (i < ops.length) {
    const op = ops[i]!;
    if (op.op === "equal") {
      rows.push({ kind: "equal", expected: op.text, actual: op.text });
      i++;
      continue;
    }
    const missing: string[] = [];
    const extra: string[] = [];
    while (i < ops.length && ops[i]!.op !== "equal") {
      (ops[i]!.op === "missing" ? missing : extra).push(ops[i]!.text);
      i++;
    }
    const pairs = Math.min(missing.length, extra.length);
    for (let k = 0; k < pairs; k++) rows.push({ kind: "different", expected: missing[k]!, actual: extra[k]! });
    for (const text of missing.slice(pairs)) rows.push({ kind: "missing", expected: text });
    for (const text of extra.slice(pairs)) rows.push({ kind: "extra", actual: text });
  }
  return rows;
}

/** `lines`: same greedy walk as matchOutput; skipped output lines are `ignored`, expected lines without a match `missing`. */
function linesRows(expected: string[], actual: string[]): DiffRow[] {
  const rows: DiffRow[] = [];
  let next = 0;
  for (const want of expected) {
    let found = next;
    while (found < actual.length && actual[found] !== want) found++;
    if (found === actual.length) {
      rows.push({ kind: "missing", expected: want });
      continue;
    }
    for (let k = next; k < found; k++) rows.push({ kind: "ignored", actual: actual[k]! });
    rows.push({ kind: "equal", expected: want, actual: want });
    next = found + 1;
  }
  for (let k = next; k < actual.length; k++) rows.push({ kind: "ignored", actual: actual[k]! });
  return rows;
}

/**
 * Line-by-line comparison of program output with the expected text, normalised like matchOutput(mode).
 * The rows hold the normalised lines (not the original ones). If matchOutput is true, no row is
 * extra, missing or different.
 */
export function diffOutput(actual: string, expected: string, mode: DiffMode): DiffRow[] {
  const e = comparedLines(expected, mode);
  const a = comparedLines(actual, mode);
  return mode === "lines" ? linesRows(e, a) : toRows(lcsOps(e, a));
}

/** Splits `expected` into the part shared with `actual` (common start and end) and the differing middle. */
export function splitDifference(expected: string, actual: string): { prefix: string; middle: string; suffix: string } {
  let p = 0;
  while (p < expected.length && p < actual.length && expected[p] === actual[p]) p++;
  let s = 0;
  while (
    s < expected.length - p &&
    s < actual.length - p &&
    expected[expected.length - 1 - s] === actual[actual.length - 1 - s]
  ) {
    s++;
  }
  return { prefix: expected.slice(0, p), middle: expected.slice(p, expected.length - s), suffix: expected.slice(expected.length - s) };
}
