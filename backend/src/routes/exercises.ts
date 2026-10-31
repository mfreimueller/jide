import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { getDb } from '../db/connection.js';
import { AppError } from '../errors.js';
import { MAX_UPLOAD_BYTES, validatePackage } from '../lib/exercise_package.js';
import { exerciseForTeacher, listExercises, saveExercise } from '../lib/exercises.js';
import { teacherAuth, type TeacherVariables } from '../middleware/teacher_auth.js';

export const exerciseRoutes = new Hono<{ Variables: TeacherVariables }>();
exerciseRoutes.use('*', teacherAuth);

exerciseRoutes.get('/', async (c) => c.json({ exercises: await listExercises(getDb(), c.get('teacher').id) }));

// Raw body (Content-Type: application/zip), not multipart: nothing to parse, and bodyLimit counts the
// stream while it is read, so an oversize upload is cut off before it is buffered.
exerciseRoutes.post(
  '/',
  bodyLimit({
    maxSize: MAX_UPLOAD_BYTES,
    onError: (c) =>
      c.json({ error: 'PAYLOAD_TOO_LARGE', message: `Die Datei ist zu groß (höchstens ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).` }, 413),
  }),
  async (c) => {
    const body = new Uint8Array(await c.req.arrayBuffer());
    if (body.length === 0) throw new AppError(400, 'INVALID_EXERCISE', 'Es wurde keine Datei hochgeladen.');
    const pkg = await validatePackage(body);
    const { exercise, replaced } = await saveExercise(getDb(), c.get('teacher').id, pkg);
    return c.json({ exercise, replaced }, replaced ? 200 : 201);
  }
);

exerciseRoutes.get('/:id', async (c) => {
  const { rowId: _rowId, ...exercise } = await exerciseForTeacher(getDb(), c.get('teacher').id, c.req.param('id'));
  return c.json({ exercise });
});
