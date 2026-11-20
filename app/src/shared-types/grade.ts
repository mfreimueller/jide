// Display helpers for grades (M8): symbols, colour class, texts, where line comments go.
import { formatDate } from "./datetime";

// Same as GradeSymbol / GradeLineComment of @jide/shared (api.ts). Not imported: the renderer must not pull in
// the Node-only shared package; main/graded.test.ts checks that the two stay in line.
export type GradeSymbol = "PLUS" | "PLUS_WELLE" | "WELLE" | "MINUS_WELLE" | "MINUS";
export interface GradeLineComment {
  path: string;
  line: number;
  text: string;
}

/** + / +~ / ~ / −~ / − (U+2212 minus). */
export const GRADE_TEXT: Record<GradeSymbol, string> = {
  PLUS: "+",
  PLUS_WELLE: "+~",
  WELLE: "~",
  MINUS_WELLE: "−~",
  MINUS: "−"
};

export type GradeTone = "good" | "mid" | "bad";

/** + and +~ green, ~ amber, −~ and − red. */
export function gradeTone(symbol: GradeSymbol): GradeTone {
  if (symbol === "PLUS" || symbol === "PLUS_WELLE") return "good";
  return symbol === "WELLE" ? "mid" : "bad";
}

/**
 * Card subtitle: "Beurteilt am Mo, 16.11. · 2 Kommentare". Without a known comment count (the list does
 * not carry it) or with none, just "Beurteilt am Mo, 16.11.".
 */
export function gradeSubtitle(gradedAt: string, commentCount?: number): string {
  const base = `Beurteilt am ${formatDate(gradedAt)}`;
  if (!commentCount || commentCount < 1) return base;
  return `${base} · ${commentCount} ${commentCount === 1 ? "Kommentar" : "Kommentare"}`;
}

/** Grey part of the "Rückmeldung" box: "beurteilt am Mo, 16.11." */
export function feedbackDate(gradedAt: string): string {
  return `beurteilt am ${formatDate(gradedAt)}`;
}

/** A line comment as shown below a line of code. `afterLine` is 1-based. */
export interface CommentZone {
  afterLine: number;
  text: string;
}

/**
 * The line comments of one file, in file order (stable for equal lines). A comment whose line is beyond the
 * end of the file (or before the first line) goes after the last line. `lineCount` counts the code lines.
 */
export function placeComments(comments: GradeLineComment[], path: string, lineCount: number): CommentZone[] {
  const last = Math.max(1, lineCount);
  return comments
    .filter((c) => c.path === path)
    .map((c, i) => ({ afterLine: Number.isFinite(c.line) && c.line >= 1 && c.line <= last ? Math.floor(c.line) : last, text: c.text, i }))
    .sort((a, b) => a.afterLine - b.afterLine || a.i - b.i)
    .map(({ afterLine, text }) => ({ afterLine, text }));
}

/** Number of line comments per file path (the "💬 N" badge in the file list). */
export function commentCounts(comments: GradeLineComment[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of comments) m.set(c.path, (m.get(c.path) ?? 0) + 1);
  return m;
}
