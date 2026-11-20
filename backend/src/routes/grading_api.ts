import { Hono } from 'hono';
import { z } from 'zod';
import { EXERCISE_PACKAGE_CONTENT_TYPE, type GradeSymbol } from '@jide/shared';
import { getDb } from '../db/connection.js';
import { AppError } from '../errors.js';
import { saveGrade, v1Courses, v1CourseOrThrow, v1Exercises, v1HandIns, v1Package } from '../lib/grading.js';
import { parseJson } from '../lib/http.js';
import { apiKeyAuth, type ApiKeyVariables } from '../middleware/api_key_auth.js';

// Grading API for grader (SPEC §5). Every route is scoped to the courses of the key's owner.
export const gradingApiRoutes = new Hono<{ Variables: ApiKeyVariables }>();
gradingApiRoutes.use('*', apiKeyAuth);

function parseId(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new AppError(404, 'NOT_FOUND', 'Nicht gefunden.');
  return n;
}

gradingApiRoutes.get('/courses', async (c) => c.json(await v1Courses(getDb(), c.get('teacherId'))));

gradingApiRoutes.get('/courses/:courseId/exercises', async (c) => {
  const db = getDb();
  const courseId = parseId(c.req.param('courseId'));
  await v1CourseOrThrow(db, c.get('teacherId'), courseId);
  return c.json(await v1Exercises(db, courseId));
});

gradingApiRoutes.get('/exercises/:exerciseId/package', async (c) => {
  const pkg = await v1Package(getDb(), c.get('teacherId'), parseId(c.req.param('exerciseId')));
  if (!pkg) throw new AppError(404, 'NOT_FOUND', 'Aufgabe nicht gefunden.');
  return c.body(new Uint8Array(pkg.zip), 200, {
    ETag: `"${pkg.version}"`,
    'Cache-Control': 'private, no-cache',
    'Content-Type': EXERCISE_PACKAGE_CONTENT_TYPE,
    'Content-Disposition': `attachment; filename="${pkg.slug}.zip"`,
  });
});

gradingApiRoutes.get('/courses/:courseId/exercises/:exerciseId/handins', async (c) => {
  const db = getDb();
  const courseId = parseId(c.req.param('courseId'));
  const exerciseId = parseId(c.req.param('exerciseId'));
  await v1CourseOrThrow(db, c.get('teacherId'), courseId);
  const rows = await db<{ deadline: Date | null }[]>`
    SELECT deadline FROM course_exercises WHERE course_id = ${courseId} AND exercise_id = ${exerciseId} AND unlocked = 1
  `;
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Aufgabe nicht gefunden.');
  return c.json(await v1HandIns(db, courseId, exerciseId, rows[0].deadline));
});

const SYMBOLS = ['PLUS', 'PLUS_WELLE', 'WELLE', 'MINUS_WELLE', 'MINUS'] as const satisfies readonly GradeSymbol[];
const gradeSchema = z.object({
  symbol: z.enum(SYMBOLS, { message: 'symbol muss PLUS, PLUS_WELLE, WELLE, MINUS_WELLE oder MINUS sein.' }),
  comment: z.string({ message: 'comment muss ein Text sein.' }).max(2000, 'Der Kommentar ist zu lang (höchstens 2000 Zeichen).'),
  lineComments: z
    .array(
      z.object({
        path: z.string({ message: 'path muss ein Text sein.' }).max(255, 'Der Dateipfad ist zu lang.'),
        line: z.number({ message: 'line muss eine Zahl sein.' }).int('line muss eine ganze Zahl sein.').min(1, 'line beginnt bei 1.').max(1_000_000, 'line ist zu groß.'),
        text: z.string({ message: 'text muss ein Text sein.' }).min(1, 'Der Zeilenkommentar darf nicht leer sein.').max(1000, 'Der Zeilenkommentar ist zu lang (höchstens 1000 Zeichen).'),
      }),
      { message: 'lineComments muss eine Liste sein.' }
    )
    .max(200, 'Zu viele Zeilenkommentare (höchstens 200).'),
});

gradingApiRoutes.put('/handins/:handinId/grade', async (c) => {
  const handinId = parseId(c.req.param('handinId'));
  const body = await parseJson(c, gradeSchema);
  const gradedAt = await saveGrade(getDb(), c.get('teacherId'), handinId, body);
  return c.json({ gradedAt: gradedAt.toISOString() });
});
