import { Hono } from 'hono';
import { getDb } from '../db/connection.js';

export const health = new Hono();

health.get('/', async (c) => {
  let dbOk = true;
  try {
    await getDb()`SELECT 1`;
  } catch {
    dbOk = false;
  }
  return c.json(
    { status: dbOk ? 'ok' : 'degraded', db: dbOk ? 'ok' : 'down', timestamp: new Date().toISOString() },
    dbOk ? 200 : 503
  );
});
