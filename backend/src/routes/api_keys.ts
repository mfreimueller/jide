import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { AppError } from '../errors.js';
import { createApiKey, listApiKeys, revokeApiKey } from '../lib/api_keys.js';
import { parseJson } from '../lib/http.js';
import { teacherAuth, type TeacherVariables } from '../middleware/teacher_auth.js';

export const apiKeyRoutes = new Hono<{ Variables: TeacherVariables }>();
apiKeyRoutes.use('*', teacherAuth);

const createSchema = z.object({
  name: z.string({ message: 'Bitte einen Namen eingeben.' }).trim().min(1, 'Bitte einen Namen eingeben.').max(100, 'Der Name ist zu lang (höchstens 100 Zeichen).'),
});

apiKeyRoutes.get('/', async (c) => c.json({ apiKeys: await listApiKeys(getDb(), c.get('teacher').id) }));

// The full key is in this response only.
apiKeyRoutes.post('/', async (c) => {
  const { name } = await parseJson(c, createSchema);
  return c.json(await createApiKey(getDb(), c.get('teacher').id, name), 201);
});

apiKeyRoutes.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) throw new AppError(404, 'NOT_FOUND', 'Schlüssel nicht gefunden.');
  await revokeApiKey(getDb(), c.get('teacher').id, id);
  return c.body(null, 204);
});
