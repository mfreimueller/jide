import { Hono } from 'hono';
import { getDb } from '../db/connection.js';
import { AppError } from '../errors.js';
import { handInDetail } from '../lib/handins.js';
import { teacherAuth, type TeacherVariables } from '../middleware/teacher_auth.js';

export const teacherHandInRoutes = new Hono<{ Variables: TeacherVariables }>();
teacherHandInRoutes.use('*', teacherAuth);

teacherHandInRoutes.get('/:handinId', async (c) => {
  const n = Number(c.req.param('handinId'));
  if (!Number.isInteger(n) || n <= 0) throw new AppError(404, 'NOT_FOUND', 'Abgabe nicht gefunden.');
  return c.json({ handin: await handInDetail(getDb(), c.get('teacher').id, n) });
});
