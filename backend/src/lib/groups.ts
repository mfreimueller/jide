import type { SQLInstance } from '../db/sql.js';
import { AppError } from '../errors.js';
import { exerciseForTeacher } from './exercises.js';

export const MAX_GROUP_NAME_LENGTH = 100;

export interface ExerciseGroupView {
  id: number;
  name: string;
}

export type MoveDirection = 'up' | 'down';

const groupNotFound = () => new AppError(404, 'NOT_FOUND', 'Gruppe nicht gefunden.');

/** The course's groups in the teacher's order. */
export async function listGroups(db: SQLInstance, courseId: number): Promise<ExerciseGroupView[]> {
  return db<ExerciseGroupView[]>`SELECT id, name FROM exercise_groups WHERE course_id = ${courseId} ORDER BY position, id`;
}

/** Groups with at least one unlocked exercise, in order (what students see). */
export async function visibleGroups(db: SQLInstance, courseId: number): Promise<ExerciseGroupView[]> {
  return db<ExerciseGroupView[]>`
    SELECT g.id, g.name FROM exercise_groups g
    WHERE g.course_id = ${courseId}
      AND EXISTS (SELECT 1 FROM course_exercises ce WHERE ce.group_id = g.id AND ce.unlocked = 1)
    ORDER BY g.position, g.id
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

async function renumberGroups(db: SQLInstance, courseId: number): Promise<void> {
  const groups = await listGroups(db, courseId);
  for (const [i, g] of groups.entries()) await db`UPDATE exercise_groups SET position = ${i} WHERE id = ${g.id}`;
}

/** Deletes the group; its exercises become ungrouped. */
export async function deleteGroup(db: SQLInstance, courseId: number, groupId: number): Promise<void> {
  await requireGroup(db, courseId, groupId);
  await db`UPDATE course_exercises SET group_id = NULL, position = NULL WHERE group_id = ${groupId} AND course_id = ${courseId}`;
  await db`DELETE FROM exercise_groups WHERE id = ${groupId}`;
  await renumberGroups(db, courseId);
}

function swapNeighbour<T>(list: T[], index: number, direction: MoveDirection): boolean {
  const other = direction === 'up' ? index - 1 : index + 1;
  if (other < 0 || other >= list.length) return false; // already at the edge: nothing to do
  [list[index], list[other]] = [list[other]!, list[index]!];
  return true;
}

/** Swaps the group with its neighbour; at the edge nothing changes. Returns the groups in the new order. */
export async function moveGroup(db: SQLInstance, courseId: number, groupId: number, direction: MoveDirection): Promise<ExerciseGroupView[]> {
  await requireGroup(db, courseId, groupId);
  const groups = await listGroups(db, courseId);
  if (swapNeighbour(groups, groups.findIndex((g) => g.id === groupId), direction)) {
    for (const [i, g] of groups.entries()) await db`UPDATE exercise_groups SET position = ${i} WHERE id = ${g.id}`;
  }
  return groups;
}

/** Exercise row ids of a group in order. */
async function groupMembers(db: SQLInstance, courseId: number, groupId: number): Promise<number[]> {
  const rows = await db<{ exerciseId: number }[]>`
    SELECT ce.exercise_id AS exerciseId FROM course_exercises ce JOIN exercises e ON e.id = ce.exercise_id
    WHERE ce.course_id = ${courseId} AND ce.group_id = ${groupId}
    ORDER BY ce.position, e.title, e.slug
  `;
  return rows.map((r) => r.exerciseId);
}

async function writeMemberPositions(db: SQLInstance, courseId: number, members: number[]): Promise<void> {
  for (const [i, exerciseId] of members.entries()) {
    await db`UPDATE course_exercises SET position = ${i} WHERE course_id = ${courseId} AND exercise_id = ${exerciseId}`;
  }
}

/** Puts the exercise at the end of the group, or takes it out of its group (groupId null). */
export async function setExerciseGroup(db: SQLInstance, teacherId: number, courseId: number, slug: string, groupId: number | null): Promise<void> {
  const { rowId } = await exerciseForTeacher(db, teacherId, slug);
  if (groupId !== null) await requireGroup(db, courseId, groupId);
  await db`INSERT IGNORE INTO course_exercises (course_id, exercise_id, unlocked, deadline) VALUES (${courseId}, ${rowId}, 0, NULL)`;
  const cur = await db<{ groupId: number | null }[]>`SELECT group_id AS groupId FROM course_exercises WHERE course_id = ${courseId} AND exercise_id = ${rowId}`;
  const oldGroup = cur[0]!.groupId;
  if (oldGroup === groupId) return;
  if (groupId === null) {
    await db`UPDATE course_exercises SET group_id = NULL, position = NULL WHERE course_id = ${courseId} AND exercise_id = ${rowId}`;
  } else {
    const next = await db<{ n: number | string }[]>`
      SELECT COALESCE(MAX(position) + 1, 0) AS n FROM course_exercises WHERE course_id = ${courseId} AND group_id = ${groupId}
    `;
    await db`UPDATE course_exercises SET group_id = ${groupId}, position = ${Number(next[0]!.n)} WHERE course_id = ${courseId} AND exercise_id = ${rowId}`;
  }
  if (oldGroup !== null) await writeMemberPositions(db, courseId, await groupMembers(db, courseId, oldGroup));
}

/** Swaps the exercise with its neighbour inside its group. Ungrouped exercises cannot be moved (400). */
export async function moveExercise(db: SQLInstance, teacherId: number, courseId: number, slug: string, direction: MoveDirection): Promise<void> {
  const { rowId } = await exerciseForTeacher(db, teacherId, slug);
  const cur = await db<{ groupId: number | null }[]>`SELECT group_id AS groupId FROM course_exercises WHERE course_id = ${courseId} AND exercise_id = ${rowId}`;
  const groupId = cur[0]?.groupId ?? null;
  if (groupId === null) throw new AppError(400, 'NOT_IN_GROUP', 'Die Aufgabe ist in keiner Gruppe.');
  const members = await groupMembers(db, courseId, groupId);
  swapNeighbour(members, members.indexOf(rowId), direction);
  await writeMemberPositions(db, courseId, members);
}
