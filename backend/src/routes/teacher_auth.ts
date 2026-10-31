import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { AppError } from '../errors.js';
import { parseJson, clientIp } from '../lib/http.js';
import { hit, rateLimit } from '../lib/rate_limit.js';
import { requestLoginLink, verifyLoginLink, deleteSession } from '../lib/teacher_auth.js';
import { teacherAuth, type TeacherVariables } from '../middleware/teacher_auth.js';

export const teacherAuthRoutes = new Hono<{ Variables: TeacherVariables }>();

const requestSchema = z.object({ email: z.string().trim().toLowerCase().email().max(255) });
const verifySchema = z.object({ token: z.string().min(10).max(200) });

const LINK_WINDOW_MS = 15 * 60 * 1000;

teacherAuthRoutes.post('/auth/request-link', async (c) => {
  const { email } = await parseJson(c, requestSchema);
  // Limits apply whether or not the address exists, so they reveal nothing.
  if (!hit(`link-ip:${clientIp(c)}`, 20, LINK_WINDOW_MS) || !hit(`link-email:${email}`, 5, LINK_WINDOW_MS)) {
    throw new AppError(429, 'RATE_LIMITED', 'Too many sign-in requests. Please try again in a few minutes.');
  }
  await requestLoginLink(getDb(), email);
  return c.json({ ok: true }, 202);
});

teacherAuthRoutes.post('/auth/verify', rateLimit('verify', 30, 60_000), async (c) => {
  const { token } = await parseJson(c, verifySchema);
  const session = await verifyLoginLink(getDb(), token);
  return c.json({ token: session.token, expiresAt: session.expiresAt.toISOString(), teacher: session.teacher });
});

teacherAuthRoutes.post('/auth/logout', teacherAuth, async (c) => {
  await deleteSession(getDb(), c.get('sessionToken'));
  return c.json({ ok: true });
});

teacherAuthRoutes.get('/me', teacherAuth, (c) => c.json({ teacher: c.get('teacher') }));
