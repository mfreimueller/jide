import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { app } from '../src/app.js';
import { setMailSender, type Mail } from '../src/lib/mailer.js';
import { resetRateLimits } from '../src/lib/rate_limit.js';
import { addTeacher } from '../src/lib/teachers.js';
import { useTestDb } from './helpers.js';

const t = useTestDb();
let mails: Mail[] = [];

beforeAll(async () => {
  setMailSender(async (m) => {
    mails.push(m);
  });
  await addTeacher(t.current().db, 'Michael@School.edu', 'Michael Freimüller');
});
afterAll(() => setMailSender(null));
beforeEach(() => {
  mails = [];
  resetRateLimits();
});

const post = (path: string, body: unknown, token?: string) =>
  app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
const get = (path: string, token?: string) =>
  app.request(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

function linkToken(mail: Mail): string {
  const m = /token=([a-f0-9]+)/.exec(mail.text);
  if (!m) throw new Error('no token in mail');
  return m[1]!;
}

async function signIn(): Promise<string> {
  await post('/api/teacher/auth/request-link', { email: 'michael@school.edu' });
  const res = await post('/api/teacher/auth/verify', { token: linkToken(mails[0]!) });
  return ((await res.json()) as { token: string }).token;
}

describe('POST /api/teacher/auth/request-link', () => {
  it('answers 202 and sends nothing for an unknown address', async () => {
    const res = await post('/api/teacher/auth/request-link', { email: 'nobody@school.edu' });
    expect(res.status).toBe(202);
    expect(mails).toHaveLength(0);
  });

  it('answers 202 with the same body for a known address and mails a link', async () => {
    const unknown = await post('/api/teacher/auth/request-link', { email: 'nobody@school.edu' });
    const known = await post('/api/teacher/auth/request-link', { email: ' MICHAEL@school.edu ' });
    expect(known.status).toBe(202);
    expect(await known.json()).toEqual(await unknown.json());
    expect(mails).toHaveLength(1);
    expect(mails[0]!.to).toBe('michael@school.edu');
    expect(mails[0]!.text).toContain('/auth/verify?token=');
  });

  it('rejects malformed emails', async () => {
    const res = await post('/api/teacher/auth/request-link', { email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'VALIDATION' });
  });

  it('limits requests per address, also for unknown ones', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await post('/api/teacher/auth/request-link', { email: 'nobody@school.edu' })).status).toBe(202);
    }
    const res = await post('/api/teacher/auth/request-link', { email: 'nobody@school.edu' });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: 'RATE_LIMITED' });
  });
});

describe('POST /api/teacher/auth/verify', () => {
  it('exchanges a link for a session that works on /me', async () => {
    await post('/api/teacher/auth/request-link', { email: 'michael@school.edu' });
    const res = await post('/api/teacher/auth/verify', { token: linkToken(mails[0]!) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; expiresAt: string; teacher: { email: string } };
    expect(body.teacher.email).toBe('michael@school.edu');
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now() + 29 * 86400_000);

    const me = await get('/api/teacher/me', body.token);
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ teacher: { displayName: 'Michael Freimüller' } });
  });

  it('works only once', async () => {
    await post('/api/teacher/auth/request-link', { email: 'michael@school.edu' });
    const token = linkToken(mails[0]!);
    expect((await post('/api/teacher/auth/verify', { token })).status).toBe(200);
    const again = await post('/api/teacher/auth/verify', { token });
    expect(again.status).toBe(400);
    expect(await again.json()).toMatchObject({ error: 'LINK_INVALID' });
  });

  it('rejects an expired link with LINK_EXPIRED', async () => {
    await post('/api/teacher/auth/request-link', { email: 'michael@school.edu' });
    await t.current().db`UPDATE login_tokens SET expires_at = ${new Date(Date.now() - 1000)}`;
    const res = await post('/api/teacher/auth/verify', { token: linkToken(mails[0]!) });
    expect(res.status).toBe(410);
    expect(await res.json()).toMatchObject({ error: 'LINK_EXPIRED' });
  });

  it('rejects a made-up token', async () => {
    const res = await post('/api/teacher/auth/verify', { token: 'f'.repeat(64) });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'LINK_INVALID' });
  });

  it('lets only one of two simultaneous requests win', async () => {
    await post('/api/teacher/auth/request-link', { email: 'michael@school.edu' });
    const token = linkToken(mails[0]!);
    const results = await Promise.all([
      post('/api/teacher/auth/verify', { token }),
      post('/api/teacher/auth/verify', { token }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
  });
});

describe('sessions', () => {
  it('requires a Bearer token', async () => {
    expect((await get('/api/teacher/me')).status).toBe(401);
    expect((await get('/api/teacher/me', 'garbage')).status).toBe(401);
  });

  it('ends on logout', async () => {
    const token = await signIn();
    expect((await post('/api/teacher/auth/logout', {}, token)).status).toBe(200);
    expect((await get('/api/teacher/me', token)).status).toBe(401);
  });

  it('ends when expired', async () => {
    const token = await signIn();
    await t.current().db`UPDATE teacher_sessions SET expires_at = ${new Date(Date.now() - 1000)}`;
    expect((await get('/api/teacher/me', token)).status).toBe(401);
  });

  it('does not store tokens in plain text', async () => {
    const token = await signIn();
    const rows = await t.current().db<{ n: number }[]>`SELECT COUNT(*) AS n FROM teacher_sessions WHERE token_hash = ${token}`;
    expect(Number(rows[0]!.n)).toBe(0);
  });
});
