import type { OpenedFile, SourceFileInput, TestResult } from "../../../shared-types/api";

/** The last finished test run of an exercise, with the code it ran against. */
export interface LastTest {
  results: TestResult[];
  summary: { passed: number; total: number };
  /** Contents of the editable files when the run started. */
  snapshot: SourceFileInput[];
  /** ISO 8601 UTC, when the run finished. */
  at: string;
}

/** Kept in memory per exercise while the app runs (not persisted). */
const lastByExercise = new Map<string, LastTest>();

export function getLastTest(exerciseId: string): LastTest | undefined {
  return lastByExercise.get(exerciseId);
}

export function setLastTest(exerciseId: string, last: LastTest): void {
  lastByExercise.set(exerciseId, last);
}

export function clearLastTests(): void {
  lastByExercise.clear();
}

/** Only the editable files: read-only ones cannot change and are not handed in. */
export function editableContents(files: OpenedFile[], contents: SourceFileInput[]): SourceFileInput[] {
  const editable = new Set(files.filter((f) => f.editable).map((f) => f.path));
  return contents.filter((c) => editable.has(c.path));
}

export function sameContents(a: SourceFileInput[], b: SourceFileInput[]): boolean {
  if (a.length !== b.length) return false;
  const byPath = new Map(b.map((f) => [f.path, f.content]));
  return a.every((f) => byPath.get(f.path) === f.content);
}

export function allPassed(summary: { passed: number; total: number }): boolean {
  return summary.total > 0 && summary.passed === summary.total;
}

export const MSG_TESTS_OK = "Dein Code sieht richtig aus!";
export const MSG_TESTS_FAILED = "Da sind noch Fehler in deinem Programm.";

export function countLabel(summary: { passed: number; total: number }): string {
  return `${summary.passed} von ${summary.total} Tests bestanden`;
}
