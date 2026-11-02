import type { SQLInstance } from '../db/sql.js';
import { sql } from '../db/sql.js';
import { AppError } from '../errors.js';
import type { ValidatedPackage } from './exercise_package.js';

export interface ExerciseView {
  id: string; // exercise id from exercise.yaml
  title: string;
  version: string;
  uploadedAt: string;
  size: number;
}

export interface CourseExerciseView extends ExerciseView {
  unlocked: boolean;
  deadline: string | null;
}

interface ExerciseRow {
  id: string;
  title: string;
  version: string;
  uploadedAt: Date;
  size: number;
}

interface CourseExerciseRow extends ExerciseRow {
  unlocked: number | null;
  deadline: Date | null;
}

const toView = (r: ExerciseRow): ExerciseView => ({
  id: r.id,
  title: r.title,
  version: r.version,
  uploadedAt: r.uploadedAt.toISOString(),
  size: r.size,
});

const toCourseView = (r: CourseExerciseRow): CourseExerciseView => ({
  ...toView(r),
  unlocked: r.unlocked === 1,
  deadline: r.deadline ? r.deadline.toISOString() : null,
});

export async function listExercises(db: SQLInstance, teacherId: number): Promise<ExerciseView[]> {
  const rows = await db<ExerciseRow[]>`
    SELECT slug AS id, title, version, uploaded_at AS uploadedAt, size
    FROM exercises WHERE teacher_id = ${teacherId} ORDER BY title, slug
  `;
  return rows.map(toView);
}

// Another teacher's exercise is a 404 (not 403), like courses.
export async function exerciseForTeacher(db: SQLInstance, teacherId: number, slug: string): Promise<ExerciseView & { rowId: number }> {
  const rows = await db<(ExerciseRow & { rowId: number })[]>`
    SELECT id AS rowId, slug AS id, title, version, uploaded_at AS uploadedAt, size
    FROM exercises WHERE teacher_id = ${teacherId} AND slug = ${slug}
  `;
  const r = rows[0];
  if (!r) throw new AppError(404, 'NOT_FOUND', 'Aufgabe nicht gefunden.');
  return { ...toView(r), rowId: r.rowId };
}

export interface ExerciseUsage {
  /** Courses the exercise is unlocked in. */
  courses: { id: number; subject: string; className: string }[];
  /** All hand-ins of the exercise, in every course, archived students included. */
  handInCount: number;
}

/** What a hard delete would take with it (for the confirmation dialog). */
export async function exerciseUsage(db: SQLInstance, teacherId: number, slug: string): Promise<ExerciseUsage> {
  const { rowId } = await exerciseForTeacher(db, teacherId, slug);
  const courses = await db<{ id: number; subject: string; className: string }[]>`
    SELECT c.id, c.subject, c.class_name AS className
    FROM course_exercises ce JOIN courses c ON c.id = ce.course_id
    WHERE ce.exercise_id = ${rowId} AND ce.unlocked = 1
    ORDER BY c.subject, c.class_name, c.id
  `;
  const count = await db<{ n: number | string }[]>`SELECT COUNT(*) AS n FROM handins WHERE exercise_id = ${rowId}`;
  return { courses, handInCount: Number(count[0]!.n) };
}

/** Hard delete; the foreign keys cascade to course links, hand-ins and hand-in files. */
export async function deleteExercise(db: SQLInstance, teacherId: number, slug: string): Promise<void> {
  const res = await db`DELETE FROM exercises WHERE teacher_id = ${teacherId} AND slug = ${slug}`;
  if (!res.affectedRows) throw new AppError(404, 'NOT_FOUND', 'Aufgabe nicht gefunden.');
}

/** Inserts the exercise, or replaces the package of the teacher's exercise with the same id (unlocks stay). */
export async function saveExercise(
  db: SQLInstance,
  teacherId: number,
  pkg: ValidatedPackage
): Promise<{ exercise: ExerciseView; replaced: boolean }> {
  if (pkg.id.length > 100) throw new AppError(400, 'INVALID_EXERCISE', 'Die id in exercise.yaml ist zu lang (höchstens 100 Zeichen).');
  if (pkg.title.length > 255) throw new AppError(400, 'INVALID_EXERCISE', 'Der title in exercise.yaml ist zu lang (höchstens 255 Zeichen).');
  const existing = await db<{ id: number }[]>`SELECT id FROM exercises WHERE teacher_id = ${teacherId} AND slug = ${pkg.id}`;
  const now = new Date();
  const data = Buffer.from(pkg.zip);
  await db`
    INSERT INTO exercises (teacher_id, slug, title, version, size, package, uploaded_at)
    VALUES (${teacherId}, ${pkg.id}, ${pkg.title}, ${pkg.version}, ${data.length}, ${data}, ${now})
    ON DUPLICATE KEY UPDATE title = VALUES(title), version = VALUES(version), size = VALUES(size),
                            package = VALUES(package), uploaded_at = VALUES(uploaded_at)
  `;
  const { rowId: _rowId, ...exercise } = await exerciseForTeacher(db, teacherId, pkg.id);
  return { exercise, replaced: existing.length > 0 };
}

/** All of the teacher's exercises with unlock state and deadline for one course. */
export async function listForCourse(db: SQLInstance, teacherId: number, courseId: number): Promise<CourseExerciseView[]> {
  const rows = await db<CourseExerciseRow[]>`
    SELECT e.slug AS id, e.title, e.version, e.uploaded_at AS uploadedAt, e.size, ce.unlocked, ce.deadline
    FROM exercises e
    LEFT JOIN course_exercises ce ON ce.exercise_id = e.id AND ce.course_id = ${courseId}
    WHERE e.teacher_id = ${teacherId}
    ORDER BY e.title, e.slug
  `;
  return rows.map(toCourseView);
}

export interface CourseExerciseChange {
  unlocked?: boolean;
  deadline?: Date | null;
}

export async function updateForCourse(
  db: SQLInstance,
  teacherId: number,
  courseId: number,
  slug: string,
  change: CourseExerciseChange
): Promise<CourseExerciseView> {
  const { rowId } = await exerciseForTeacher(db, teacherId, slug);
  await db`INSERT IGNORE INTO course_exercises (course_id, exercise_id, unlocked, deadline) VALUES (${courseId}, ${rowId}, 0, NULL)`;
  const set: Record<string, unknown> = {};
  if (change.unlocked !== undefined) set.unlocked = change.unlocked ? 1 : 0;
  if (change.deadline !== undefined) set.deadline = change.deadline;
  if (Object.keys(set).length > 0) {
    await db`UPDATE course_exercises SET ${sql(set)} WHERE course_id = ${courseId} AND exercise_id = ${rowId}`;
  }
  const all = await listForCourse(db, teacherId, courseId);
  return all.find((e) => e.id === slug)!;
}

// ---- student side ----

export interface StudentExerciseRow {
  id: string;
  title: string;
  version: string;
  deadline: string | null;
}

export async function unlockedForCourse(db: SQLInstance, courseId: number): Promise<StudentExerciseRow[]> {
  const rows = await db<{ id: string; title: string; version: string; deadline: Date | null }[]>`
    SELECT e.slug AS id, e.title, e.version, ce.deadline
    FROM course_exercises ce JOIN exercises e ON e.id = ce.exercise_id
    WHERE ce.course_id = ${courseId} AND ce.unlocked = 1
    ORDER BY e.title, e.slug
  `;
  return rows.map((r) => ({ ...r, deadline: r.deadline ? r.deadline.toISOString() : null }));
}

export async function unlockedVersion(db: SQLInstance, courseId: number, slug: string): Promise<string | null> {
  const rows = await db<{ version: string }[]>`
    SELECT e.version FROM course_exercises ce JOIN exercises e ON e.id = ce.exercise_id
    WHERE ce.course_id = ${courseId} AND ce.unlocked = 1 AND e.slug = ${slug}
  `;
  return rows[0]?.version ?? null;
}

/** The package bytes, only if the exercise is unlocked for the course. */
export async function unlockedPackage(db: SQLInstance, courseId: number, slug: string): Promise<{ version: string; zip: Buffer } | null> {
  const rows = await db<{ version: string; zip: Buffer }[]>`
    SELECT e.version, e.package AS zip
    FROM course_exercises ce JOIN exercises e ON e.id = ce.exercise_id
    WHERE ce.course_id = ${courseId} AND ce.unlocked = 1 AND e.slug = ${slug}
  `;
  return rows[0] ?? null;
}
