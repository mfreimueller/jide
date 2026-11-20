// Hiding exercises in the student's list (M9 T54). Pure rules; the choice is stored per account in main (hidden-store.ts).
import { formatDate, isPast } from "./datetime";
import type { ExerciseGroup, ExerciseSummary } from "./api";
import { OTHER_EXERCISES_TITLE } from "./grouping";

/** What the student chose for one exercise. No entry = automatic rule. */
export type HideMode = "hidden" | "shown";
export type HideModes = Record<string, HideMode>;

/** A graded exercise moves to "Ausgeblendet" this long after grading (unless the student chose "Wieder anzeigen"). */
export const AUTO_HIDE_MS = 7 * 24 * 60 * 60 * 1000;

export const HIDE_DISABLED_REASON = "Erst nach der Abgabe oder nach der Frist möglich";

/** Manual "Ausblenden" is allowed once handed in (at least once), graded, or past the deadline. */
export function mayHide(ex: ExerciseSummary, now: Date = new Date()): boolean {
  if (ex.scratch) return false;
  return !!ex.grade || ex.status === "abgegeben" || ex.submittedAt !== null || isPast(ex.deadline, now);
}

/** hidden || (not shown && graded && graded at least 7 days ago). */
export function isHidden(ex: ExerciseSummary, mode: HideMode | undefined, now: Date = new Date()): boolean {
  if (ex.scratch) return false;
  if (mode === "hidden") return true;
  if (mode === "shown" || !ex.grade) return false;
  const t = new Date(ex.grade.gradedAt).getTime();
  return !Number.isNaN(t) && now.getTime() - t >= AUTO_HIDE_MS;
}

/** Only keep entries with a valid mode (the file is plain JSON on disk). */
export function cleanModes(raw: unknown): HideModes {
  const out: HideModes = {};
  if (raw && typeof raw === "object") {
    for (const [id, m] of Object.entries(raw as Record<string, unknown>)) {
      if (m === "hidden" || m === "shown") out[id] = m;
    }
  }
  return out;
}

export type HiddenKind = "graded" | "handed-in" | "late" | "other";

/** Row subtitle (after the group name) and which chip the row shows. */
export function hiddenState(ex: ExerciseSummary): { kind: HiddenKind; text: string } {
  if (ex.grade) return { kind: "graded", text: `beurteilt ${formatDate(ex.grade.gradedAt)}` };
  if (ex.status === "abgegeben" || ex.submittedAt) {
    return { kind: "handed-in", text: ex.submittedAt ? `abgegeben ${formatDate(ex.submittedAt)}` : "abgegeben" };
  }
  if (ex.deadline && isPast(ex.deadline)) return { kind: "late", text: `Frist vorbei ${formatDate(ex.deadline)}` };
  return { kind: "other", text: "" };
}

export function hiddenSubtitle(ex: ExerciseSummary, groups: ExerciseGroup[]): string {
  const group = groups.find((g) => g.id === ex.groupId)?.name ?? OTHER_EXERCISES_TITLE;
  const state = hiddenState(ex).text;
  return state ? `${group} · ${state}` : group;
}

/** "5 Aufgaben" / "1 Aufgabe". */
export function hiddenCount(n: number): string {
  return `${n} ${n === 1 ? "Aufgabe" : "Aufgaben"}`;
}

/** The hidden exercises in the order of the server list (newest first). Scratch items never. */
export function hiddenExercises(list: ExerciseSummary[], modes: HideModes, now: Date = new Date()): ExerciseSummary[] {
  return list.filter((e) => isHidden(e, modes[e.id], now));
}
