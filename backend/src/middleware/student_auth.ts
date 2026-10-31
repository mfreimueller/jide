import type { Context, Next } from 'hono';
import { getDb } from '../db/connection.js';
import { AppError } from '../errors.js';
import { normaliseCode } from '../lib/access_code.js';
import { clientIp } from '../lib/http.js';
import { recordFailure, tooManyFailures } from '../lib/rate_limit.js';
import { bearerToken } from './teacher_auth.js';

export interface Student {
  id: number;
  name: string;
  courseId: number;
  subject: string;
  className: string;
}

export interface StudentVariables {
  student: Student;
}

// Only failures count: a whole class shares one school IP (see rate_limit.ts).
export const STUDENT_MAX_FAILURES = 50;
export const STUDENT_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const ACTIVITY_INTERVAL_MS = 60_000;

const INVALID_CODE = 'Dieser Code ist ungültig. Bitte prüfe ihn oder frage deine Lehrkraft.';

/** Resolves a raw code to its student; 401 for unknown codes or archived courses. Rate-limited per IP. */
export async function authenticateStudent(c: Context, rawCode: string | null | undefined): Promise<Student> {
  const key = `student:${clientIp(c)}`;
  const code = rawCode ? normaliseCode(rawCode) : null;
  const rows = code
    ? await getDb()<(Student & { archived: number })[]>`
        SELECT s.id, s.name, s.course_id AS courseId, c.subject, c.class_name AS className, c.archived
        FROM students s JOIN courses c ON c.id = s.course_id
        WHERE s.code = ${code}
      `
    : [];
  const student = rows[0];
  if (!student || student.archived === 1) {
    // A valid code is never blocked; only failures are counted and, over the limit, answered with 429.
    recordFailure(key);
    if (tooManyFailures(key, STUDENT_MAX_FAILURES, STUDENT_FAILURE_WINDOW_MS)) {
      throw new AppError(429, 'RATE_LIMITED', 'Zu viele falsche Versuche. Bitte warte ein paar Minuten.');
    }
    throw new AppError(401, 'UNAUTHORIZED', INVALID_CODE);
  }
  const now = new Date();
  await getDb()`
    UPDATE students SET last_activity_at = ${now}
    WHERE id = ${student.id} AND (last_activity_at IS NULL OR last_activity_at < ${new Date(now.getTime() - ACTIVITY_INTERVAL_MS)})
  `;
  return { id: student.id, name: student.name, courseId: student.courseId, subject: student.subject, className: student.className };
}

export async function studentAuth(c: Context, next: Next) {
  c.set('student', await authenticateStudent(c, bearerToken(c)));
  await next();
}
