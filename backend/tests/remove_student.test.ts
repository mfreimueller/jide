import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { app } from '../src/app.js';
import { resetRateLimits } from '../src/lib/rate_limit.js';
import { createSession } from '../src/lib/teacher_auth.js';
import { signedInTeacher, useTestDb, type TestTeacher } from './helpers.js';

const t = useTestDb();

const YAML = 'id: ex-a\ntitle: Aufgabe\nfiles:\n  - path: Main.java\nmainFile: Main.java\n';
const PKG = zipSync({ 'exercise.yaml': strToU8(YAML), 'aufgabe.md': strToU8('# x'), 'files/Main.java': strToU8('class Main {}') });

let anna: TestTeacher;
let ben: TestTeacher;
let course: number;
let eva: { id: number; name: string; code: string };
let tom: { id: number; name: string; code: string };

async function json<T = any>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
const asStudent = (code: string, method: string, p: string, body?: unknown) =>
  app.request(p, {
    method,
    headers: { Authorization: `Bearer ${code}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const login = (code: string) =>
  app.request('/api/student/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
const remove = (teacher: TestTeacher, c: number, id: number) => teacher.call('DELETE', `/api/teacher/courses/${c}/students/${id}`);
const students = async () => (await json(await anna.call('GET', `/api/teacher/courses/${course}/students`))).students as any[];

beforeAll(async () => {
  anna = await signedInTeacher(t.current().db, 'anna@school.edu', 'Anna');
  ben = await signedInTeacher(t.current().db, 'ben@school.edu', 'Ben');
  const token = (await createSession(t.current().db, anna.id)).token;
  const up = await app.request('/api/teacher/exercises', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/zip' },
    body: PKG as RequestInit['body'],
  });
  expect(up.status).toBe(201);
  course = (await json(await anna.call('POST', '/api/teacher/courses', { subject: 'POS', className: '1AHIF' }))).course.id;
  [eva, tom] = (await json(await anna.call('POST', `/api/teacher/courses/${course}/students`, { names: 'Eva\nTom' }))).students;
  await anna.call('PUT', `/api/teacher/courses/${course}/exercises/ex-a`, { unlocked: true });
  for (const s of [eva, tom]) {
    const r = await asStudent(s.code, 'POST', '/api/exercises/ex-a/handins', { files: [{ path: 'Main.java', content: s.name }], testSummary: null });
    expect(r.status).toBeLessThan(300);
  }
});
beforeEach(() => resetRateLimits());

describe('DELETE /api/teacher/courses/:courseId/students/:id', () => {
  it('works for Eva before she is removed', async () => {
    expect((await asStudent(eva.code, 'GET', '/api/student/me')).status).toBe(200);
    expect((await login(eva.code)).status).toBe(200);
  });

  it('archives the student: code dead at once, hidden everywhere, hand-ins kept', async () => {
    const hid = (await t.current().db<{ id: number }[]>`SELECT id FROM handins WHERE student_id = ${eva.id}`)[0]!.id;
    expect((await remove(anna, course, eva.id)).status).toBe(204);

    expect((await login(eva.code)).status).toBe(401);
    expect((await asStudent(eva.code, 'GET', '/api/student/me')).status).toBe(401);
    expect((await asStudent(eva.code, 'GET', '/api/exercises')).status).toBe(401);

    expect((await students()).map((s) => s.name)).toEqual(['Tom']);
    const list = await json(await anna.call('GET', '/api/teacher/courses'));
    expect(list.courses[0].studentCount).toBe(1);
    expect((await json(await anna.call('GET', `/api/teacher/courses/${course}`))).course.studentCount).toBe(1);

    const m = await json(await anna.call('GET', `/api/teacher/courses/${course}/handins`));
    expect(m.students.map((s: any) => s.name)).toEqual(['Tom']);
    expect(m.rows).toHaveLength(1);

    const zip = await anna.call('GET', `/api/teacher/courses/${course}/exercises/ex-a/handins.zip`);
    expect(Object.keys(unzipSync(new Uint8Array(await zip.arrayBuffer())))).toEqual(['Tom/Main.java']);

    // the hand-in belongs to an archived student and is no longer reachable through the teacher views
    expect((await anna.call('GET', `/api/teacher/handins/${hid}`)).status).toBe(404);

    // ...but the rows are still in the database
    const db = t.current().db;
    expect((await db<{ n: number | string }[]>`SELECT COUNT(*) AS n FROM handins WHERE student_id = ${eva.id}`)[0]!.n).toBe(1);
    const row = (await db<{ archivedAt: Date | null }[]>`SELECT archived_at AS archivedAt FROM students WHERE id = ${eva.id}`)[0]!;
    expect(row.archivedAt).not.toBeNull();
  });

  it('a wrong code after removal counts like an unknown code (same 401 body)', async () => {
    const gone = await login(eva.code);
    const unknown = await login('ZZZZ-ZZZZ');
    expect(gone.status).toBe(unknown.status);
    expect(await gone.json()).toEqual(await unknown.json());
  });

  it('other students keep working, and removal does not touch the neighbour in the hand-in detail', async () => {
    expect((await asStudent(tom.code, 'GET', '/api/student/me')).status).toBe(200);
    const tomHid = (await t.current().db<{ id: number }[]>`SELECT id FROM handins WHERE student_id = ${tom.id}`)[0]!.id;
    const d = (await json(await anna.call('GET', `/api/teacher/handins/${tomHid}`))).handin;
    expect(d.previous).toBeNull();
    expect(d.next).toBeNull();
  });

  it('is 404 the second time, for unknown ids and for another course', async () => {
    expect((await remove(anna, course, eva.id)).status).toBe(404);
    expect((await remove(anna, course, 999999)).status).toBe(404);
    const other = (await json(await anna.call('POST', '/api/teacher/courses', { subject: 'DBI', className: '2AHIF' }))).course.id;
    expect((await remove(anna, other, tom.id)).status).toBe(404);
    expect((await students()).map((s) => s.name)).toEqual(['Tom']);
  });

  it('is 404 for a foreign teacher and leaves the student alone', async () => {
    expect((await remove(ben, course, tom.id)).status).toBe(404);
    expect((await asStudent(tom.code, 'GET', '/api/student/me')).status).toBe(200);
  });

  it('reset-code on an archived student is 404', async () => {
    expect((await anna.call('POST', `/api/teacher/courses/${course}/students/${eva.id}/reset-code`)).status).toBe(404);
  });

  it('adding the same name again creates a new student with a new code', async () => {
    const again = (await json(await anna.call('POST', `/api/teacher/courses/${course}/students`, { names: 'Eva' }))).students;
    expect(again).toHaveLength(1);
    expect(again[0].id).not.toBe(eva.id);
    expect(again[0].code).not.toBe(eva.code);
    expect((await students()).map((s) => s.name)).toEqual(['Eva', 'Tom']);
    expect((await login(eva.code)).status).toBe(401);
    expect((await login(again[0].code)).status).toBe(200);
  });
});
