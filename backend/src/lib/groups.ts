import type { SQLInstance } from '../db/sql.js';
import { AppError } from '../errors.js';
import { exerciseForTeacher } from './exercises.js';

export const MAX_GROUP_NAME_LENGTH = 100;

export interface ExerciseGroupView {
  id: number;
  name: string;
}

const groupNotFound = () => new AppError(404, 'NOT_FOUND', 'Gruppe nicht gefunden.');

/** The course's groups, sorted by name (the teacher's page). */
export async function listGroups(db: SQLInstance, courseId: number): Promise<ExerciseGroupView[]> {
  return db<ExerciseGroupView[]>`SELECT id, name FROM exercise_groups WHERE course_id = ${courseId} ORDER BY name, id`;
}

/**
 * Groups with at least one unlocked exercise (what students see), the one with the most recently
 * unlocked exercise first. Groups whose visible exercises all have no unlock date come last.
 */
export async function visibleGroups(db: SQLInstance, courseId: number): Promise<ExerciseGroupView[]> {
  return db<ExerciseGroupView[]>`
    SELECT g.id, g.name FROM exercise_groups g
    JOIN course_exercises ce ON ce.group_id = g.id AND ce.unlocked = 1
    WHERE g.course_id = ${courseId}
    GROUP BY g.id, g.name
    ORDER BY MAX(ce.unlocked_at) IS NULL, MAX(ce.unlocked_at) DESC, g.name, g.id
  `;
}

async function requireGroup(db: SQLInstance, courseId: number, groupId: number): Promise<ExerciseGroupView> {
  const rows = await db<ExerciseGroupView[]>`SELECT id, name FROM exercise_groups WHERE id = ${groupId} AND course_id = ${courseId}`;
  if (!rows[0]) throw groupNotFound();
  return rows[0];
}

async function assertNameFree(db: SQLInstance, courseId: number, name: string, exceptId: number | null): Promise<void> {
  const rows = await db<{ id: number }[]>`SELECT id FROM exercise_groups WHERE course_id = ${courseId} AND name = ${name}`;
  if (rows.some((r) => r.id !== exceptId)) throw new AppError(409, 'DUPLICATE_GROUP', 'Diese Gruppe gibt es schon.');
}

export async function createGroup(db: SQLInstance, courseId: number, name: string): Promise<ExerciseGroupView> {
  await assertNameFree(db, courseId, name, null);
  // The position column stays (NOT NULL, no data dropped) but nothing orders by it any more.
  const next = await db<{ n: number | string }[]>`SELECT COALESCE(MAX(position) + 1, 0) AS n FROM exercise_groups WHERE course_id = ${courseId}`;
  const res = await db`
    INSERT INTO exercise_groups (course_id, name, position, created_at) VALUES (${courseId}, ${name}, ${Number(next[0]!.n)}, ${new Date()})
  `;
  return { id: res.lastInsertRowid, name };
}

export async function renameGroup(db: SQLInstance, courseId: number, groupId: number, name: string): Promise<ExerciseGroupView> {
  await requireGroup(db, courseId, groupId);
  await assertNameFree(db, courseId, name, groupId);
  await db`UPDATE exercise_groups SET name = ${name} WHERE id = ${groupId}`;
  return { id: groupId, name };
}

/** Deletes the group; its exercises become ungrouped. */
export async function deleteGroup(db: SQLInstance, courseId: number, groupId: number): Promise<void> {
  await requireGroup(db, courseId, groupId);
  await db`UPDATE course_exercises SET group_id = NULL WHERE group_id = ${groupId} AND course_id = ${courseId}`;
  await db`DELETE FROM exercise_groups WHERE id = ${groupId}`;
}

/** Puts the exercise into the group, or takes it out of its group (groupId null). */
export async function setExerciseGroup(db: SQLInstance, teacherId: number, courseId: number, slug: string, groupId: number | null): Promise<void> {
  const { rowId } = await exerciseForTeacher(db, teacherId, slug);
  if (groupId !== null) await requireGroup(db, courseId, groupId);
  await db`INSERT IGNORE INTO course_exercises (course_id, exercise_id, unlocked, deadline) VALUES (${courseId}, ${rowId}, 0, NULL)`;
  await db`UPDATE course_exercises SET group_id = ${groupId} WHERE course_id = ${courseId} AND exercise_id = ${rowId}`;
}
