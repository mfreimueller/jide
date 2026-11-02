import type { ExerciseGroup, ExerciseSummary } from "./api";

/** One block of the student's exercise list. `title` null = no heading (plain list). */
export interface ExerciseSection {
  key: string;
  title: string | null;
  /** "N / M abgegeben" for a group, null for other blocks. */
  progress: string | null;
  exercises: ExerciseSummary[];
}

export const OTHER_EXERCISES_TITLE = "Weitere Übungen";

/** Open exercises first, then handed-in ones; each part keeps the incoming order. */
function openFirst(list: ExerciseSummary[]): ExerciseSummary[] {
  return [...list.filter((e) => e.status !== "abgegeben"), ...list.filter((e) => e.status === "abgegeben")];
}

/**
 * Splits the list into the teacher's groups (in their order, exercises in the teacher's order),
 * then the ungrouped ones under "Weitere Übungen". Groups without a visible exercise are left out.
 * Without any such group the result is one plain block without a heading.
 */
export function sectionExercises(exercises: ExerciseSummary[], groups: ExerciseGroup[]): ExerciseSection[] {
  const known = new Set(groups.map((g) => g.id));
  const sections: ExerciseSection[] = [];
  for (const g of groups) {
    const items = exercises.filter((e) => e.groupId === g.id);
    if (items.length === 0) continue;
    const done = items.filter((e) => e.status === "abgegeben").length;
    sections.push({ key: `group-${g.id}`, title: g.name, progress: `${done} / ${items.length} abgegeben`, exercises: items });
  }
  const rest = openFirst(exercises.filter((e) => e.groupId === null || e.groupId === undefined || !known.has(e.groupId)));
  if (sections.length === 0) {
    return rest.length > 0 ? [{ key: "plain", title: null, progress: null, exercises: rest }] : [];
  }
  if (rest.length > 0) sections.push({ key: "other", title: OTHER_EXERCISES_TITLE, progress: null, exercises: rest });
  return sections;
}
