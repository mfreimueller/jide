import type { SQLInstance } from '../db/sql.js';
import { AppError } from '../errors.js';
import { formatCode, generateAccessCode } from './access_code.js';

export const MAX_NAME_LENGTH = 100;
export const MAX_NAMES_PER_REQUEST = 60;

export interface Course {
  id: number;
  subject: string;
  className: string;
  archived: boolean;
  createdAt: string;
  studentCount: number;
}

interface CourseRow {
  id: number;
  subject: string;
  className: string;
  archived: number;
  createdAt: Date;
  studentCount: number | string;
}

function toCourse(r: CourseRow): Course {
  return {
    id: r.id,
    subject: r.subject,
    className: r.className,
    archived: r.archived === 1,
    createdAt: r.createdAt.toISOString(),
    studentCount: Number(r.studentCount),
  };
}

export async function listCourses(db: SQLInstance, teacherId: number, includeArchived: boolean): Promise<Course[]> {
  const rows = await db<CourseRow[]>`
    SELECT c.id, c.subject, c.class_name AS className, c.archived, c.created_at AS createdAt,
           (SELECT COUNT(*) FROM students s WHERE s.course_id = c.id) AS studentCount
    FROM courses c
    WHERE c.teacher_id = ${teacherId} AND (${includeArchived ? 1 : 0} = 1 OR c.archived = 0)
    ORDER BY c.archived, c.subject, c.class_name, c.id
  `;
  return rows.map(toCourse);
}

// Another teacher's course is a 404 (not 403) so ids cannot be probed.
export async function courseForTeacher(db: SQLInstance, teacherId: number, courseId: number): Promise<Course> {
  const rows = await db<CourseRow[]>`
    SELECT c.id, c.subject, c.class_name AS className, c.archived, c.created_at AS createdAt,
           (SELECT COUNT(*) FROM students s WHERE s.course_id = c.id) AS studentCount
    FROM courses c WHERE c.id = ${courseId} AND c.teacher_id = ${teacherId}
  `;
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Kurs nicht gefunden.');
  return toCourse(rows[0]);
}

export async function createCourse(
  db: SQLInstance,
  teacherId: number,
  subject: string,
  className: string
): Promise<Course> {
  const res = await db`
    INSERT INTO courses (teacher_id, subject, class_name, archived, created_at)
    VALUES (${teacherId}, ${subject}, ${className}, 0, ${new Date()})
  `;
  return courseForTeacher(db, teacherId, res.lastInsertRowid);
}

export async function setArchived(db: SQLInstance, teacherId: number, courseId: number, archived: boolean) {
  await courseForTeacher(db, teacherId, courseId);
  await db`UPDATE courses SET archived = ${archived ? 1 : 0} WHERE id = ${courseId}`;
  return courseForTeacher(db, teacherId, courseId);
}

// ---- students ----

export interface StudentView {
  id: number;
  name: string;
  code: string; // formatted XXXX-XXXX
  lastActivityAt: string | null; // null = "noch nie angemeldet"
  handInCount: number;
}

interface StudentRow {
  id: number;
  name: string;
  code: string;
  lastActivityAt: Date | null;
}

function toStudentView(r: StudentRow): StudentView {
  return {
    id: r.id,
    name: r.name,
    code: formatCode(r.code),
    lastActivityAt: r.lastActivityAt ? r.lastActivityAt.toISOString() : null,
    // TODO(T12): count the student's hand-ins once the hand-ins table exists.
    handInCount: 0,
  };
}

export async function listStudents(db: SQLInstance, courseId: number): Promise<StudentView[]> {
  const rows = await db<StudentRow[]>`
    SELECT id, name, code, last_activity_at AS lastActivityAt
    FROM students WHERE course_id = ${courseId} ORDER BY name, id
  `;
  return rows.map(toStudentView);
}

/** One name per line; trims, skips empty lines. Rejects the whole paste on over-long names or too many lines. */
export function parseNames(text: string): string[] {
  const names = text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter((l) => l.length > 0);
  if (names.length === 0) throw new AppError(400, 'VALIDATION', 'Bitte mindestens einen Namen eingeben.');
  if (names.length > MAX_NAMES_PER_REQUEST) {
    throw new AppError(400, 'VALIDATION', `Bitte höchstens ${MAX_NAMES_PER_REQUEST} Namen auf einmal eingeben.`);
  }
  const tooLong = names.find((n) => n.length > MAX_NAME_LENGTH);
  if (tooLong) {
    throw new AppError(400, 'VALIDATION', `Ein Name ist länger als ${MAX_NAME_LENGTH} Zeichen: „${tooLong.slice(0, 20)}…“`);
  }
  return names;
}

function isDuplicateKey(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'ER_DUP_ENTRY';
}

// The UNIQUE index decides; on a collision just draw another code.
async function insertWithFreshCode(db: SQLInstance, courseId: number, name: string): Promise<number> {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const res = await db`
        INSERT INTO students (course_id, name, code, created_at)
        VALUES (${courseId}, ${name}, ${generateAccessCode()}, ${new Date()})
      `;
      return res.lastInsertRowid;
    } catch (e) {
      if (!isDuplicateKey(e)) throw e;
    }
  }
  throw new Error('could not generate a unique student code');
}

export async function addStudents(db: SQLInstance, courseId: number, names: string[]): Promise<StudentView[]> {
  const ids: number[] = [];
  for (const name of names) ids.push(await insertWithFreshCode(db, courseId, name));
  const all = await listStudents(db, courseId);
  const added = new Set(ids);
  return all.filter((s) => added.has(s.id));
}

export async function resetCode(db: SQLInstance, courseId: number, studentId: number): Promise<StudentView> {
  const owned = await db<{ id: number }[]>`SELECT id FROM students WHERE id = ${studentId} AND course_id = ${courseId}`;
  if (!owned[0]) throw new AppError(404, 'NOT_FOUND', 'Schüler:in nicht gefunden.');
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await db`UPDATE students SET code = ${generateAccessCode()} WHERE id = ${studentId}`;
      const rows = await db<StudentRow[]>`
        SELECT id, name, code, last_activity_at AS lastActivityAt FROM students WHERE id = ${studentId}
      `;
      return toStudentView(rows[0]!);
    } catch (e) {
      if (!isDuplicateKey(e)) throw e;
    }
  }
  throw new Error('could not generate a unique student code');
}
