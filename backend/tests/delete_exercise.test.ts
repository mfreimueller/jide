import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { app } from '../src/app.js';
import { resetRateLimits } from '../src/lib/rate_limit.js';
import { createSession } from '../src/lib/teacher_auth.js';
import { signedInTeacher, useTestDb, type TestTeacher } from './helpers.js';

const t = useTestDb();

const pkg = (id: string) =>
  zipSync({
    'exercise.yaml': strToU8(`id: ${id}\ntitle: Titel ${id}\nfiles:\n  - path: Main.java\nmainFile: Main.java\n`),
    'aufgabe.md': strToU8('# x'),
    'files/Main.java': strToU8('class Main {}'),
  });

let anna: TestTeacher;
let ben: TestTeacher;
let pos: number;
let dbi: number;
let students: { id: number; name: string; code: string }[];

async function json<T = any>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
async function upload(teacher: TestTeacher, id: string) {
  const token = (await createSession(t.current().db, teacher.id)).token;
  const r = await app.request('/api/teacher/exercises', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/zip' },
    body: pkg(id) as RequestInit['body'],
  });
  expect(r.status).toBe(201);
}
const handIn = (code: string, slug: string, name: string) =>
  app.request(`/api/exercises/${slug}/handins`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${code}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: [{ path: 'Main.java', content: name }], testSummary: null }),
  });
const count = async (table: string) =>
  Number((await t.current().db.unsafe(`SELECT COUNT(*) AS n FROM ${table}`) as { n: number | string }[])[0]!.n);

beforeAll(async () => {
  anna = await signedInTeacher(t.current().db, 'anna@school.edu', 'Anna');
  ben = await signedInTeacher(t.current().db, 'ben@school.edu', 'Ben');
  await upload(anna, 'ex-a');
  await upload(anna, 'ex-b');
  await upload(ben, 'ex-a');
  pos = (await json(await anna.call('POST', '/api/teacher/courses', { subject: 'POS', className: '1AHIF' }))).course.id;
  dbi = (await json(await anna.call('POST', '/api/teacher/courses', { subject: 'DBI', className: '2AHIF' }))).course.id;
  students = (await json(await anna.call('POST', `/api/teacher/courses/${pos}/students`, { names: 'Eva\nTom' }))).students;
  const [lena] = (await json(await anna.call('POST', `/api/teacher/courses/${dbi}/students`, { names: 'Lena' }))).students;
  students.push(lena);
  for (const c of [pos, dbi]) await anna.call('PUT', `/api/teacher/courses/${c}/exercises/ex-a`, { unlocked: true });
  await anna.call('PUT', `/api/teacher/courses/${pos}/exercises/ex-b`, { unlocked: true });
  for (const s of students) expect((await handIn(s.code, 'ex-a', s.name)).status).toBeLessThan(300);
  // a second version from Eva, and a hand-in to ex-b that must survive
  expect((await handIn(students[0]!.code, 'ex-a', 'Eva 2')).status).toBeLessThan(300);
  expect((await handIn(students[0]!.code, 'ex-b', 'Eva b')).status).toBeLessThan(300);
  // an archived student's hand-in counts too
  await anna.call('DELETE', `/api/teacher/courses/${pos}/students/${students[1]!.id}`);
});
beforeEach(() => resetRateLimits());

describe('GET /api/teacher/exercises/:id/usage', () => {
  it('lists the courses it is unlocked in and counts all hand-ins (archived students included)', async () => {
    const u = await json(await anna.call('GET', '/api/teacher/exercises/ex-a/usage'));
    expect(u.courses).toEqual([
      { id: dbi, subject: 'DBI', className: '2AHIF' },
      { id: pos, subject: 'POS', className: '1AHIF' },
    ]);
    expect(u.handInCount).toBe(4);
  });

  it('leaves out courses where it is not unlocked', async () => {
    await anna.call('PUT', `/api/teacher/courses/${dbi}/exercises/ex-a`, { unlocked: false });
    const u = await json(await anna.call('GET', '/api/teacher/exercises/ex-a/usage'));
    expect(u.courses.map((c: any) => c.id)).toEqual([pos]);
    expect(u.handInCount).toBe(4);
    await anna.call('PUT', `/api/teacher/courses/${dbi}/exercises/ex-a`, { unlocked: true });
  });

  it('is 404 for another teacher\'s and unknown exercises', async () => {
    expect((await ben.call('GET', '/api/teacher/exercises/ex-b/usage')).status).toBe(404);
    expect((await anna.call('GET', '/api/teacher/exercises/nope/usage')).status).toBe(404);
  });
});

describe('DELETE /api/teacher/exercises/:id', () => {
  it('another teacher\'s exercise is 404 and stays intact', async () => {
    const before = [await count('exercises'), await count('course_exercises'), await count('handins'), await count('handin_files')];
    expect((await ben.call('DELETE', '/api/teacher/exercises/ex-b')).status).toBe(404);
    expect((await anna.call('DELETE', '/api/teacher/exercises/nope')).status).toBe(404);
    expect([await count('exercises'), await count('course_exercises'), await count('handins'), await count('handin_files')]).toEqual(before);
    expect((await anna.call('GET', '/api/teacher/exercises/ex-b')).status).toBe(200);
  });

  it('removes the exercise, its course links, hand-ins and hand-in files, and nothing else', async () => {
    const db = t.current().db;
    expect(await count('handins')).toBe(5);
    expect((await anna.call('DELETE', '/api/teacher/exercises/ex-a')).status).toBe(204);

    expect((await anna.call('GET', '/api/teacher/exercises/ex-a')).status).toBe(404);
    expect((await json(await anna.call('GET', '/api/teacher/exercises'))).exercises.map((e: any) => e.id)).toEqual(['ex-b']);
    for (const c of [pos, dbi]) {
      const list = (await json(await anna.call('GET', `/api/teacher/courses/${c}/exercises`))).exercises;
      expect(list.map((e: any) => e.id)).toEqual(['ex-b']);
    }
    // the other teacher's exercise with the same id is untouched
    expect((await ben.call('GET', '/api/teacher/exercises/ex-a')).status).toBe(200);
    expect(await count('exercises')).toBe(2);

    // only the ex-b link and Eva's ex-b hand-in with its file are left
    expect(await count('course_exercises')).toBe(1);
    expect(await count('handins')).toBe(1);
    expect(await count('handin_files')).toBe(1);
    const left = await db<{ slug: string }[]>`SELECT e.slug FROM handins h JOIN exercises e ON e.id = h.exercise_id`;
    expect(left.map((r) => r.slug)).toEqual(['ex-b']);
  });

  it('is 404 the second time', async () => {
    expect((await anna.call('DELETE', '/api/teacher/exercises/ex-a')).status).toBe(404);
  });

  it('students no longer see it, and handing in gets 404', async () => {
    const list = await app.request('/api/exercises', { headers: { Authorization: `Bearer ${students[2]!.code}` } });
    expect((await json(list)).exercises).toEqual([]);
    expect((await handIn(students[2]!.code, 'ex-a', 'late')).status).toBe(404);
  });

  it('the same id can be uploaded again as a new exercise', async () => {
    await upload(anna, 'ex-a');
    const u = await json(await anna.call('GET', '/api/teacher/exercises/ex-a/usage'));
    expect(u).toEqual({ courses: [], handInCount: 0 });
  });
});
