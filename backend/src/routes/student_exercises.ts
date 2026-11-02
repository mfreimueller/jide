import { Hono } from 'hono';
import { EXERCISE_PACKAGE_CONTENT_TYPE, type StudentExerciseListResponse } from '@jide/shared';
import { getDb } from '../db/connection.js';
import { AppError } from '../errors.js';
import { unlockedForCourse, unlockedPackage, unlockedVersion } from '../lib/exercises.js';
import { visibleGroups } from '../lib/groups.js';
import { studentAuth, type StudentVariables } from '../middleware/student_auth.js';

export const studentExerciseRoutes = new Hono<{ Variables: StudentVariables }>();
studentExerciseRoutes.use('*', studentAuth);

studentExerciseRoutes.get('/', async (c) => {
  const db = getDb();
  const { courseId } = c.get('student');
  const exercises = await unlockedForCourse(db, courseId);
  const groups = await visibleGroups(db, courseId);
  return c.json({ exercises, groups } satisfies StudentExerciseListResponse);
});

function matchesEtag(header: string | undefined, version: string): boolean {
  if (!header) return false;
  if (header.trim() === '*') return true;
  return header.split(',').some((t) => t.trim().replace(/^W\//, '') === `"${version}"`);
}

studentExerciseRoutes.get('/:id', async (c) => {
  const db = getDb();
  const { courseId } = c.get('student');
  const id = c.req.param('id');
  const notFound = new AppError(404, 'NOT_FOUND', 'Diese Aufgabe ist nicht verfügbar.');

  const version = await unlockedVersion(db, courseId, id);
  if (!version) throw notFound;
  const headers = { ETag: `"${version}"`, 'Cache-Control': 'private, no-cache' };
  if (matchesEtag(c.req.header('If-None-Match'), version)) return c.body(null, 304, headers);

  const pkg = await unlockedPackage(db, courseId, id);
  if (!pkg) throw notFound;
  return c.body(new Uint8Array(pkg.zip), 200, {
    ...headers,
    ETag: `"${pkg.version}"`,
    'Content-Type': EXERCISE_PACKAGE_CONTENT_TYPE,
    'Content-Disposition': `attachment; filename="${id}.zip"`,
  });
});
