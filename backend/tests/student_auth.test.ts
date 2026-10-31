import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { app } from '../src/app.js';
import { resetRateLimits } from '../src/lib/rate_limit.js';
import { STUDENT_MAX_FAILURES } from '../src/middleware/student_auth.js';
import { signedInTeacher, useTestDb, type TestTeacher } from './helpers.js';

const t = useTestDb();
let teacher: TestTeacher;

beforeAll(async () => {
  teacher = await signedInTeacher(t.current().db, 'anna@school.edu', 'Anna');
});
beforeEach(() => resetRateLimits());

interface Fixture {
  courseId: number;
  studentId: number;
  code: string; // formatted
}

async function fixture(name = 'Eva Maier'): Promise<Fixture> {
  const c = (await (await teacher.call('POST', '/api/teacher/courses', { subject: 'POS', className: '1AHIF' })).json()) as {
    course: { id: number };
  };
  const s = (await (await teacher.call('POST', `/api/teacher/courses/${c.course.id}/students`, { names: name })).json()) as {
    students: { id: number; code: string }[];
  };
  return { courseId: c.course.id, studentId: s.students[0]!.id, code: s.students[0]!.code };
}

const login = (code: unknown, ip = '10.0.0.1') =>
  app.request('/api/student/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ code }),
  });
const me = (code?: string, ip = '10.0.0.1') =>
  app.request('/api/student/me', {
    headers: { 'x-forwarded-for': ip, ...(code ? { Authorization: `Bearer ${code}` } : {}) },
  });
const lastActivity = async (id: number) =>
  (await t.current().db<{ at: Date | null }[]>`SELECT last_activity_at AS at FROM students WHERE id = ${id}`)[0]!.at;

describe('POST /api/student/login', () => {
  it('returns name and course', async () => {
    const f = await fixture();
    const res = await login(f.code);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: 'Eva Maier', course: { subject: 'POS', className: '1AHIF' } });
  });

  it('accepts lower case, no dash and spaces', async () => {
    const f = await fixture();
    const plain = f.code.replace('-', '');
    for (const input of [f.code.toLowerCase(), plain, plain.toLowerCase(), ` ${plain.slice(0, 4)} ${plain.slice(4).toLowerCase()} `]) {
      expect((await login(input)).status, input).toBe(200);
    }
  });

  it('answers 401 in German for a wrong, malformed or missing code', async () => {
    await fixture();
    for (const code of ['ABCD-EFGH', 'zzz', '', 12345, undefined]) {
      const res = await login(code);
      expect([400, 401], String(code)).toContain(res.status);
      const body = (await res.json()) as { message: string };
      expect(body.message).toMatch(/Code/);
    }
    expect((await login('ABCD-EFGH')).status).toBe(401);
    expect((await login('')).status).toBe(401);
  });

  it('sets last activity on login', async () => {
    const f = await fixture();
    expect(await lastActivity(f.studentId)).toBeNull();
    await login(f.code);
    const first = await lastActivity(f.studentId);
    expect(first).toBeInstanceOf(Date);
    const list = (await (await teacher.call('GET', `/api/teacher/courses/${f.courseId}/students`)).json()) as {
      students: { lastActivityAt: string | null }[];
    };
    expect(list.students[0]!.lastActivityAt).toBe(first!.toISOString());
  });

  it('updates last activity at most once a minute', async () => {
    const f = await fixture();
    await login(f.code);
    const first = await lastActivity(f.studentId);
    await me(f.code);
    expect(await lastActivity(f.studentId)).toEqual(first);
    const old = new Date(Date.now() - 5 * 60_000);
    await t.current().db`UPDATE students SET last_activity_at = ${old} WHERE id = ${f.studentId}`;
    await me(f.code);
    expect((await lastActivity(f.studentId))!.getTime()).toBeGreaterThan(old.getTime() + 60_000);
  });
});

describe('student Bearer middleware', () => {
  it('GET /api/student/me works with the code in any notation', async () => {
    const f = await fixture();
    const res = await me(f.code.replace('-', '').toLowerCase());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: 'Eva Maier', course: { subject: 'POS', className: '1AHIF' } });
  });

  it('rejects a missing or wrong code', async () => {
    expect((await me()).status).toBe(401);
    expect((await me('ABCD-EFGH')).status).toBe(401);
  });

  it('a teacher session token is not a student code', async () => {
    const res = await app.request('/api/student/me', { headers: { Authorization: 'Bearer abc' } });
    expect(res.status).toBe(401);
  });
});

describe('reset code', () => {
  it('old code fails at once, new code works', async () => {
    const f = await fixture();
    expect((await me(f.code)).status).toBe(200);
    const res = await teacher.call('POST', `/api/teacher/courses/${f.courseId}/students/${f.studentId}/reset-code`);
    expect(res.status).toBe(200);
    const { student } = (await res.json()) as { student: { code: string; name: string } };
    expect(student.name).toBe('Eva Maier');
    expect(student.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(student.code).not.toBe(f.code);

    expect((await me(f.code)).status).toBe(401);
    expect((await login(f.code)).status).toBe(401);
    expect((await me(student.code)).status).toBe(200);
    expect((await login(student.code)).status).toBe(200);
  });
});

describe('archived course', () => {
  it('rejects login and student routes, and works again after unarchiving', async () => {
    const f = await fixture();
    expect((await me(f.code)).status).toBe(200);
    await teacher.call('POST', `/api/teacher/courses/${f.courseId}/archive`);
    expect((await login(f.code)).status).toBe(401);
    expect((await me(f.code)).status).toBe(401);
    await teacher.call('POST', `/api/teacher/courses/${f.courseId}/unarchive`);
    expect((await login(f.code)).status).toBe(200);
  });
});

describe('rate limit', () => {
  it('blocks an IP after too many failures, other IPs are unaffected', async () => {
    const f = await fixture();
    for (let i = 0; i < STUDENT_MAX_FAILURES; i++) expect((await login('ABCD-EFGH', '10.9.9.9')).status).toBe(401);
    const blocked = await login('ABCD-EFGH', '10.9.9.9');
    expect(blocked.status).toBe(429);
    expect(((await blocked.json()) as { message: string }).message).toMatch(/Versuche/);
    expect((await me(f.code, '10.9.9.9')).status).toBe(429);
    expect((await login(f.code, '10.8.8.8')).status).toBe(200);
  });

  it('never counts successful logins', async () => {
    const f = await fixture();
    for (let i = 0; i < STUDENT_MAX_FAILURES * 3; i++) expect((await login(f.code, '10.7.7.7')).status).toBe(200);
  });
});
