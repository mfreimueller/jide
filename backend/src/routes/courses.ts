import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { AppError } from '../errors.js';
import {
  addStudents,
  courseForTeacher,
  createCourse,
  listCourses,
  listStudents,
  parseNames,
  resetCode,
  setArchived,
} from '../lib/courses.js';
import { parseJson } from '../lib/http.js';
import { teacherAuth, type TeacherVariables } from '../middleware/teacher_auth.js';

export const courseRoutes = new Hono<{ Variables: TeacherVariables }>();
courseRoutes.use('*', teacherAuth);

const createSchema = z.object({
  subject: z.string({ message: 'Bitte ein Fach eingeben.' }).trim().min(1, 'Bitte ein Fach eingeben.').max(50, 'Das Fach ist zu lang.'),
  className: z.string({ message: 'Bitte eine Klasse eingeben.' }).trim().min(1, 'Bitte eine Klasse eingeben.').max(50, 'Die Klasse ist zu lang.'),
});
const studentsSchema = z.object({ names: z.string({ message: 'Bitte Namen eingeben.' }) });

function parseId(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new AppError(404, 'NOT_FOUND', 'Nicht gefunden.');
  return n;
}

courseRoutes.get('/', async (c) => {
  const includeArchived = c.req.query('archived') === '1';
  return c.json({ courses: await listCourses(getDb(), c.get('teacher').id, includeArchived) });
});

courseRoutes.post('/', async (c) => {
  const body = await parseJson(c, createSchema);
  return c.json({ course: await createCourse(getDb(), c.get('teacher').id, body.subject, body.className) }, 201);
});

courseRoutes.get('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  return c.json({ course: await courseForTeacher(getDb(), c.get('teacher').id, id) });
});

courseRoutes.post('/:id/archive', async (c) => {
  const id = parseId(c.req.param('id'));
  return c.json({ course: await setArchived(getDb(), c.get('teacher').id, id, true) });
});

courseRoutes.post('/:id/unarchive', async (c) => {
  const id = parseId(c.req.param('id'));
  return c.json({ course: await setArchived(getDb(), c.get('teacher').id, id, false) });
});

courseRoutes.get('/:id/students', async (c) => {
  const db = getDb();
  const id = parseId(c.req.param('id'));
  await courseForTeacher(db, c.get('teacher').id, id);
  return c.json({ students: await listStudents(db, id) });
});

courseRoutes.post('/:id/students', async (c) => {
  const db = getDb();
  const id = parseId(c.req.param('id'));
  await courseForTeacher(db, c.get('teacher').id, id);
  const { names } = await parseJson(c, studentsSchema);
  return c.json({ students: await addStudents(db, id, parseNames(names)) }, 201);
});

courseRoutes.post('/:id/students/:studentId/reset-code', async (c) => {
  const db = getDb();
  const id = parseId(c.req.param('id'));
  const studentId = parseId(c.req.param('studentId'));
  await courseForTeacher(db, c.get('teacher').id, id);
  return c.json({ student: await resetCode(db, id, studentId) });
});
