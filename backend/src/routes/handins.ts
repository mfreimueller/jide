import { Hono } from 'hono';
import { z } from 'zod';
import type { HandInResponse, LatestHandInResponse } from '@jide/shared';
import { getDb } from '../db/connection.js';
import { AppError } from '../errors.js';
import {
  createHandIn,
  editablePaths,
  isLate,
  latestForStudent,
  MAX_HANDIN_BYTES,
  unlockedExerciseRef,
  validateHandInFiles,
} from '../lib/handins.js';
import { parseJson } from '../lib/http.js';
import { studentAuth, type StudentVariables } from '../middleware/student_auth.js';

export const studentHandInRoutes = new Hono<{ Variables: StudentVariables }>();
studentHandInRoutes.use('*', studentAuth);

const bodySchema = z.object({
  files: z.array(
    z.object({
      path: z.string({ message: 'path muss ein Text sein.' }).max(255, 'Der Dateipfad ist zu lang.'),
      content: z.string({ message: 'content muss ein Text sein.' }),
    }),
    { message: 'files muss eine Liste sein.' }
  ),
  testSummary: z
    .union([
      z
        .object({
          passed: z.number().int('passed muss eine ganze Zahl sein.').min(0).max(100_000),
          total: z.number().int('total muss eine ganze Zahl sein.').min(0).max(100_000),
        })
        .refine((s) => s.passed <= s.total, { message: 'passed darf nicht größer als total sein.' }),
      z.null(),
    ])
    .optional(),
});

const notFound = () => new AppError(404, 'NOT_FOUND', 'Diese Aufgabe ist nicht verfügbar.');

studentHandInRoutes.post('/:id/handins', async (c) => {
  const db = getDb();
  const { id: studentId, courseId } = c.get('student');
  const declared = Number(c.req.header('content-length'));
  if (declared > 2 * MAX_HANDIN_BYTES) throw new AppError(413, 'TOO_LARGE', 'Die Abgabe ist zu groß (höchstens 1 MB Quelltext).');

  const ex = await unlockedExerciseRef(db, courseId, c.req.param('id'));
  if (!ex) throw notFound();
  const body = await parseJson(c, bodySchema);
  validateHandInFiles(body.files, editablePaths(ex.zip, c.req.param('id')));
  // The client clock is never used: createHandIn takes the server time.
  const submittedAt = await createHandIn(db, studentId, ex, body.files, body.testSummary ?? null);
  return c.json({ submittedAt: submittedAt.toISOString(), late: isLate(submittedAt, ex.deadline) } satisfies HandInResponse, 201);
});

studentHandInRoutes.get('/:id/handins/latest', async (c) => {
  const db = getDb();
  const ex = await unlockedExerciseRef(db, c.get('student').courseId, c.req.param('id'));
  if (!ex) throw notFound();
  const latest = await latestForStudent(db, c.get('student').id, ex.rowId);
  if (!latest) throw new AppError(404, 'NOT_FOUND', 'Du hast diese Aufgabe noch nicht abgegeben.');
  return c.json(latest satisfies LatestHandInResponse);
});
