import type { Context } from 'hono';
import type { ZodType } from 'zod';
import { AppError } from '../errors.js';

export async function parseJson<T>(c: Context, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new AppError(400, 'VALIDATION', 'Request body must be valid JSON.');
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.join('.') || 'body';
    throw new AppError(400, 'VALIDATION', `${where}: ${first?.message ?? 'invalid'}`);
  }
  return result.data;
}

// Behind the reverse proxy the real client address is the first X-Forwarded-For entry.
export function clientIp(c: Context): string {
  const fwd = c.req.header('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || 'unknown';
}
