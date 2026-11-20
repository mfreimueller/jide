import type { Difficulty, GradeSymbol, HandInFile, StudentGradeResponse } from '@jide/shared';
import type { SQLInstance } from '../db/sql.js';
import { sql } from '../db/sql.js';
import { AppError } from '../errors.js';
import { isLate } from './handins.js';

// ---- reading (Grading API, /api/v1) ----

export interface V1Course {
  id: number;
  subject: string;
  className: string;
  students: { id: number; name: string }[];
}

/** The key owner's active courses with their active students. */
export async function v1Courses(db: SQLInstance, teacherId: number): Promise<V1Course[]> {
  const courses = await db<{ id: number; subject: string; className: string }[]>`
    SELECT id, subject, class_name AS className FROM courses
    WHERE teacher_id = ${teacherId} AND archived = 0 ORDER BY subject, class_name, id
  `;
  const students = await db<{ id: number; name: string; courseId: number }[]>`
    SELECT s.id, s.name, s.course_id AS courseId
    FROM students s JOIN courses c ON c.id = s.course_id AND c.teacher_id = ${teacherId} AND c.archived = 0
    WHERE s.archived_at IS NULL ORDER BY s.name, s.id
  `;
  return courses.map((c) => ({
    ...c,
    students: students.filter((s) => s.courseId === c.id).map((s) => ({ id: s.id, name: s.name })),
  }));
}

/** 404 unless the course is an active course of the teacher. */
export async function v1CourseOrThrow(db: SQLInstance, teacherId: number, courseId: number): Promise<void> {
  const rows = await db<{ id: number }[]>`SELECT id FROM courses WHERE id = ${courseId} AND teacher_id = ${teacherId} AND archived = 0`;
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Kurs nicht gefunden.');
}

export interface V1Exercise {
  id: number;
  slug: string;
  title: string;
  difficulty: Difficulty | null;
  unlockedAt: string | null;
  deadline: string | null;
}

export async function v1Exercises(db: SQLInstance, courseId: number): Promise<V1Exercise[]> {
  const rows = await db<
    { id: number; slug: string; title: string; difficulty: Difficulty | null; unlockedAt: Date | null; deadline: Date | null }[]
  >`
    SELECT e.id, e.slug, e.title, e.difficulty, ce.unlocked_at AS unlockedAt, ce.deadline
    FROM course_exercises ce JOIN exercises e ON e.id = ce.exercise_id
    WHERE ce.course_id = ${courseId} AND ce.unlocked = 1
    ORDER BY e.title, e.slug
  `;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    difficulty: r.difficulty ?? null,
    unlockedAt: r.unlockedAt ? r.unlockedAt.toISOString() : null,
    deadline: r.deadline ? r.deadline.toISOString() : null,
  }));
}

/** The package of an exercise of the teacher (any exercise they own, unlocked or not). */
export async function v1Package(db: SQLInstance, teacherId: number, exerciseId: number): Promise<{ slug: string; version: string; zip: Buffer } | null> {
  const rows = await db<{ slug: string; version: string; zip: Buffer }[]>`
    SELECT slug, version, package AS zip FROM exercises WHERE id = ${exerciseId} AND teacher_id = ${teacherId}
  `;
  return rows[0] ?? null;
}

export interface V1HandIn {
  handinId: number;
  studentId: number;
  submittedAt: string;
  late: boolean;
  testsPassed: number | null;
  testsTotal: number | null;
  graded: boolean;
  files: HandInFile[];
}

/** Latest hand-in of every active student of the course; students without one are left out. */
export async function v1HandIns(db: SQLInstance, courseId: number, exerciseId: number, deadline: Date | null): Promise<V1HandIn[]> {
  const rows = await db<
    { id: number; studentId: number; submittedAt: Date; passed: number | null; total: number | null; graded: number | string }[]
  >`
    SELECT h.id, h.student_id AS studentId, h.submitted_at AS submittedAt, h.tests_passed AS passed, h.tests_total AS total,
           (SELECT COUNT(*) FROM grades g WHERE g.student_id = h.student_id AND g.exercise_id = h.exercise_id) AS graded
    FROM handins h
    JOIN students s ON s.id = h.student_id AND s.course_id = ${courseId} AND s.archived_at IS NULL
    WHERE h.exercise_id = ${exerciseId}
      AND h.id = (SELECT MAX(y.id) FROM handins y WHERE y.student_id = h.student_id AND y.exercise_id = h.exercise_id)
    ORDER BY s.name, s.id
  `;
  if (rows.length === 0) return [];
  const files = await db<(HandInFile & { handinId: number })[]>`
    SELECT handin_id AS handinId, path, content FROM handin_files WHERE handin_id IN ${sql(rows.map((r) => r.id))} ORDER BY path
  `;
  return rows.map((r) => ({
    handinId: r.id,
    studentId: r.studentId,
    submittedAt: r.submittedAt.toISOString(),
    late: isLate(r.submittedAt, deadline),
    testsPassed: r.passed === null ? null : Number(r.passed),
    testsTotal: r.total === null ? null : Number(r.total),
    graded: Number(r.graded) > 0,
    files: files.filter((f) => f.handinId === r.id).map(({ path, content }) => ({ path, content })),
  }));
}

// ---- writing ----

export interface GradeInput {
  symbol: GradeSymbol;
  comment: string;
  lineComments: { path: string; line: number; text: string }[];
}

/** Saves (replaces) the grade of the hand-in's student + exercise. Returns the grading time. */
export async function saveGrade(db: SQLInstance, teacherId: number, handinId: number, input: GradeInput): Promise<Date> {
  const rows = await db<{ id: number; studentId: number; exerciseId: number }[]>`
    SELECT h.id, h.student_id AS studentId, h.exercise_id AS exerciseId
    FROM handins h
    JOIN students s ON s.id = h.student_id AND s.archived_at IS NULL
    JOIN courses c ON c.id = s.course_id AND c.teacher_id = ${teacherId} AND c.archived = 0
    WHERE h.id = ${handinId}
  `;
  const h = rows[0];
  if (!h) throw new AppError(404, 'NOT_FOUND', 'Abgabe nicht gefunden.');

  const paths = new Set((await db<{ path: string }[]>`SELECT path FROM handin_files WHERE handin_id = ${handinId}`).map((f) => f.path));
  for (const lc of input.lineComments) {
    if (!paths.has(lc.path)) {
      throw new AppError(400, 'INVALID_PATH', `Die Datei „${lc.path.slice(0, 100)}“ gehört nicht zu dieser Abgabe.`);
    }
  }

  const newer = await db<{ id: number }[]>`
    SELECT id FROM handins WHERE student_id = ${h.studentId} AND exercise_id = ${h.exerciseId} AND id > ${handinId} LIMIT 1
  `;
  if (newer[0]) {
    throw new AppError(409, 'NEWER_HANDIN', 'Die Person hat seither neu abgegeben. Bitte lade die Abgaben neu.');
  }

  const gradedAt = new Date();
  await db.begin(async (tx) => {
    await tx`
      INSERT INTO grades (student_id, exercise_id, handin_id, symbol, comment, graded_at)
      VALUES (${h.studentId}, ${h.exerciseId}, ${handinId}, ${input.symbol}, ${input.comment}, ${gradedAt})
      ON DUPLICATE KEY UPDATE handin_id = VALUES(handin_id), symbol = VALUES(symbol), comment = VALUES(comment), graded_at = VALUES(graded_at)
    `;
    const g = await tx<{ id: number }[]>`SELECT id FROM grades WHERE student_id = ${h.studentId} AND exercise_id = ${h.exerciseId} FOR UPDATE`;
    const gradeId = g[0]!.id;
    await tx`DELETE FROM grade_comments WHERE grade_id = ${gradeId}`;
    for (const lc of input.lineComments) {
      await tx`INSERT INTO grade_comments (grade_id, path, line, text) VALUES (${gradeId}, ${lc.path}, ${lc.line}, ${lc.text})`;
    }
  });
  return gradedAt;
}

// ---- student side ----

/** Grades of the student by exercise row id. */
export async function gradesOfStudent(db: SQLInstance, studentId: number): Promise<Map<number, { symbol: GradeSymbol; gradedAt: string }>> {
  const rows = await db<{ exerciseId: number; symbol: GradeSymbol; gradedAt: Date }[]>`
    SELECT exercise_id AS exerciseId, symbol, graded_at AS gradedAt FROM grades WHERE student_id = ${studentId}
  `;
  return new Map(rows.map((r) => [r.exerciseId, { symbol: r.symbol, gradedAt: r.gradedAt.toISOString() }]));
}

export async function isGraded(db: SQLInstance, studentId: number, exerciseRowId: number): Promise<boolean> {
  const rows = await db<{ id: number }[]>`SELECT id FROM grades WHERE student_id = ${studentId} AND exercise_id = ${exerciseRowId}`;
  return rows.length > 0;
}

export async function gradeForStudent(db: SQLInstance, studentId: number, exerciseRowId: number): Promise<StudentGradeResponse | null> {
  const rows = await db<
    { id: number; symbol: GradeSymbol; comment: string; gradedAt: Date; handinId: number; submittedAt: Date }[]
  >`
    SELECT g.id, g.symbol, g.comment, g.graded_at AS gradedAt, g.handin_id AS handinId, h.submitted_at AS submittedAt
    FROM grades g JOIN handins h ON h.id = g.handin_id
    WHERE g.student_id = ${studentId} AND g.exercise_id = ${exerciseRowId}
  `;
  const g = rows[0];
  if (!g) return null;
  const files = await db<HandInFile[]>`SELECT path, content FROM handin_files WHERE handin_id = ${g.handinId} ORDER BY path`;
  const lineComments = await db<{ path: string; line: number; text: string }[]>`
    SELECT path, line, text FROM grade_comments WHERE grade_id = ${g.id} ORDER BY id
  `;
  return {
    symbol: g.symbol,
    comment: g.comment,
    gradedAt: g.gradedAt.toISOString(),
    handinId: g.handinId,
    submittedAt: g.submittedAt.toISOString(),
    files,
    lineComments: lineComments.map((l) => ({ path: l.path, line: Number(l.line), text: l.text })),
  };
}
