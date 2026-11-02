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
  removeStudent,
  resetCode,
  setArchived,
} from '../lib/courses.js';
import { handInMatrix, lastHandInsZip } from '../lib/handins.js';
import { exerciseForTeacher, listForCourse, updateForCourse } from '../lib/exercises.js';
import {
  MAX_GROUP_NAME_LENGTH,
  createGroup,
  deleteGroup,
  listGroups,
  moveExercise,
  moveGroup,
  renameGroup,
} from '../lib/groups.js';
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

const courseExerciseSchema = z
  .object({
    unlocked: z.boolean({ message: 'unlocked muss true oder false sein.' }).optional(),
    // ISO 8601 instant; the teacher UI converts Vienna time to UTC. null clears the deadline.
    deadline: z
      .union([z.iso.datetime({ offset: true, message: 'deadline muss ein ISO-8601-Zeitpunkt sein, z. B. 2026-12-01T22:59:00Z.' }), z.null()])
      .optional(),
    // Group of this course, or null for "no group".
    groupId: z.union([z.number({ message: 'groupId muss eine Zahl oder null sein.' }).int('groupId muss eine ganze Zahl sein.'), z.null()]).optional(),
  })
  .refine((b) => b.unlocked !== undefined || b.deadline !== undefined || b.groupId !== undefined, {
    message: 'Bitte unlocked, deadline oder groupId angeben.',
  });

const groupSchema = z.object({
  name: z
    .string({ message: 'Bitte einen Namen eingeben.' })
    .trim()
    .min(1, 'Bitte einen Namen eingeben.')
    .max(MAX_GROUP_NAME_LENGTH, 'Der Name ist zu lang (höchstens 100 Zeichen).'),
});
const moveSchema = z.object({ direction: z.enum(['up', 'down'], { message: 'direction muss "up" oder "down" sein.' }) });

courseRoutes.get('/:id/exercises', async (c) => {
  const db = getDb();
  const teacherId = c.get('teacher').id;
  const id = parseId(c.req.param('id'));
  await courseForTeacher(db, teacherId, id);
  return c.json({ exercises: await listForCourse(db, teacherId, id), groups: await listGroups(db, id) });
});

courseRoutes.post('/:id/exercises/:exerciseId/move', async (c) => {
  const db = getDb();
  const teacherId = c.get('teacher').id;
  const id = parseId(c.req.param('id'));
  await courseForTeacher(db, teacherId, id);
  const { direction } = await parseJson(c, moveSchema);
  await moveExercise(db, teacherId, id, c.req.param('exerciseId'), direction);
  return c.json({ exercises: await listForCourse(db, teacherId, id), groups: await listGroups(db, id) });
});

courseRoutes.get('/:id/groups', async (c) => {
  const db = getDb();
  const id = parseId(c.req.param('id'));
  await courseForTeacher(db, c.get('teacher').id, id);
  return c.json({ groups: await listGroups(db, id) });
});

courseRoutes.post('/:id/groups', async (c) => {
  const db = getDb();
  const id = parseId(c.req.param('id'));
  await courseForTeacher(db, c.get('teacher').id, id);
  const { name } = await parseJson(c, groupSchema);
  return c.json({ group: await createGroup(db, id, name) }, 201);
});

courseRoutes.put('/:id/groups/:groupId', async (c) => {
  const db = getDb();
  const id = parseId(c.req.param('id'));
  const groupId = parseId(c.req.param('groupId'));
  await courseForTeacher(db, c.get('teacher').id, id);
  const { name } = await parseJson(c, groupSchema);
  return c.json({ group: await renameGroup(db, id, groupId, name) });
});

courseRoutes.delete('/:id/groups/:groupId', async (c) => {
  const db = getDb();
  const id = parseId(c.req.param('id'));
  const groupId = parseId(c.req.param('groupId'));
  await courseForTeacher(db, c.get('teacher').id, id);
  await deleteGroup(db, id, groupId);
  return c.body(null, 204);
});

courseRoutes.post('/:id/groups/:groupId/move', async (c) => {
  const db = getDb();
  const id = parseId(c.req.param('id'));
  const groupId = parseId(c.req.param('groupId'));
  await courseForTeacher(db, c.get('teacher').id, id);
  const { direction } = await parseJson(c, moveSchema);
  return c.json({ groups: await moveGroup(db, id, groupId, direction) });
});

courseRoutes.put('/:id/exercises/:exerciseId', async (c) => {
  const db = getDb();
  const teacherId = c.get('teacher').id;
  const id = parseId(c.req.param('id'));
  await courseForTeacher(db, teacherId, id);
  const body = await parseJson(c, courseExerciseSchema);
  const deadline =
    body.deadline === undefined ? undefined : body.deadline === null ? null : new Date(Math.floor(Date.parse(body.deadline) / 1000) * 1000);
  const exercise = await updateForCourse(db, teacherId, id, c.req.param('exerciseId'), { unlocked: body.unlocked, deadline, groupId: body.groupId });
  return c.json({ exercise });
});

courseRoutes.get('/:id/handins', async (c) => {
  const db = getDb();
  const id = parseId(c.req.param('id'));
  await courseForTeacher(db, c.get('teacher').id, id);
  // ?missing=1 keeps only students who lack a hand-in for at least one unlocked exercise.
  return c.json(await handInMatrix(db, id, c.req.query('missing') === '1'));
});

courseRoutes.get('/:id/exercises/:exerciseId/handins.zip', async (c) => {
  const db = getDb();
  const id = parseId(c.req.param('id'));
  await courseForTeacher(db, c.get('teacher').id, id);
  const ex = await exerciseForTeacher(db, c.get('teacher').id, c.req.param('exerciseId'));
  const zip = await lastHandInsZip(db, id, ex.rowId);
  return c.body(new Uint8Array(zip), 200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${ex.id}-abgaben.zip"`,
  });
});

courseRoutes.post('/:id/students/:studentId/reset-code', async (c) => {
  const db = getDb();
  const id = parseId(c.req.param('id'));
  const studentId = parseId(c.req.param('studentId'));
  await courseForTeacher(db, c.get('teacher').id, id);
  return c.json({ student: await resetCode(db, id, studentId) });
});

courseRoutes.delete('/:id/students/:studentId', async (c) => {
  const db = getDb();
  const id = parseId(c.req.param('id'));
  const studentId = parseId(c.req.param('studentId'));
  await courseForTeacher(db, c.get('teacher').id, id);
  await removeStudent(db, id, studentId);
  return c.body(null, 204);
});
