import type { Context, Next } from 'hono';
import { getDb } from '../db/connection.js';
import { AppError } from '../errors.js';
import { teacherIdForKey } from '../lib/api_keys.js';
import { bearerToken } from './teacher_auth.js';

export interface ApiKeyVariables {
  /** Owner of the API key. */
  teacherId: number;
}

export async function apiKeyAuth(c: Context, next: Next) {
  const key = bearerToken(c);
  if (!key) throw new AppError(401, 'UNAUTHORIZED', 'Der API-Schlüssel fehlt.');
  const teacherId = await teacherIdForKey(getDb(), key);
  if (teacherId === null) throw new AppError(401, 'UNAUTHORIZED', 'Der API-Schlüssel ist ungültig oder wurde widerrufen.');
  c.set('teacherId', teacherId);
  await next();
}
