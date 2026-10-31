import type { Context, Next } from 'hono';
import { getDb } from '../db/connection.js';
import { AppError } from '../errors.js';
import { hashToken } from '../lib/hash.js';
import type { Teacher } from '../lib/teachers.js';

export interface TeacherVariables {
  teacher: Teacher;
  sessionToken: string;
}

export function bearerToken(c: Context): string | null {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7) || null;
}

export async function teacherAuth(c: Context, next: Next) {
  const token = bearerToken(c);
  if (!token) throw new AppError(401, 'UNAUTHORIZED', 'Please sign in.');

  const rows = await getDb()<Teacher[]>`
    SELECT t.id, t.email, t.display_name AS displayName
    FROM teacher_sessions s JOIN teachers t ON t.id = s.teacher_id
    WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > ${new Date()}
  `;
  const teacher = rows[0];
  if (!teacher) throw new AppError(401, 'UNAUTHORIZED', 'Your session has expired. Please sign in again.');

  c.set('teacher', teacher);
  c.set('sessionToken', token);
  await next();
}
