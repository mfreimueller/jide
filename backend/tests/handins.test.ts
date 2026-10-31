import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { strToU8, unzipSync, strFromU8, zipSync } from 'fflate';
import { app } from '../src/app.js';
import { isLate, MAX_HANDIN_FILES, MAX_HANDIN_BYTES, safeFolderName, uniqueFolderNames } from '../src/lib/handins.js';
import { resetRateLimits } from '../src/lib/rate_limit.js';
import { createSession } from '../src/lib/teacher_auth.js';
import { signedInTeacher, useTestDb, type TestTeacher } from './helpers.js';

const t = useTestDb();

const YAML = (id: string) =>
  `id: ${id}\ntitle: Aufgabe ${id}\nfiles:\n  - path: Main.java\n  - path: util/Helper.java\n  - path: Given.java\n    editable: false\nmainFile: Main.java\n`;
function pkg(id: string): Uint8Array {
  return zipSync({
    'exercise.yaml': strToU8(YAML(id)),
    'aufgabe.md': strToU8('# x'),
    'files/Main.java': strToU8('class Main {}'),
    'files/util/Helper.java': strToU8('class Helper {}'),
    'files/Given.java': strToU8('class Given {}'),
  });
}

let anna: TestTeacher;
let ben: TestTeacher;
let annaToken: string;

async function json<T = any>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
async function upload(id: string) {
  const res = await app.request('/api/teacher/exercises', {
    method: 'POST',
    headers: { Authorization: `Bearer ${annaToken}`, 'Content-Type': 'application/zip' },
    body: pkg(id) as RequestInit['body'],
  });
  expect(res.status).toBe(201);
}
async function newCourse(teacher = anna): Promise<number> {
  return (await json(await teacher.call('POST', '/api/teacher/courses', { subject: 'POS', className: '1AHIF' }))).course.id;
}
async function addStudents(courseId: number, names: string[], teacher = anna) {
  const res = await teacher.call('POST', `/api/teacher/courses/${courseId}/students`, { names: names.join('\n') });
  return (await json(res)).students as { id: number; name: string; code: string }[];
}
const unlock = (courseId: number, ex: string, deadline?: string | null) =>
  anna.call('PUT', `/api/teacher/courses/${courseId}/exercises/${ex}`, { unlocked: true, ...(deadline === undefined ? {} : { deadline }) });

function asStudent(code: string) {
  return (method: string, p: string, body?: unknown) =>
    app.request(p, {
      method,
      headers: { Authorization: `Bearer ${code}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
}
const main = (content: string) => ({ path: 'Main.java', content });

beforeAll(async () => {
  anna = await signedInTeacher(t.current().db, 'anna@school.edu', 'Anna');
  ben = await signedInTeacher(t.current().db, 'ben@school.edu', 'Ben');
  annaToken = (await createSession(t.current().db, anna.id)).token;
  await upload('ex-a');
  await upload('ex-b');
});
beforeEach(() => resetRateLimits());

describe('isLate', () => {
  const deadline = new Date('2026-12-01T22:59:00.000Z');
  it('is never late without a deadline', () => expect(isLate(new Date(), null)).toBe(false));
  it('is not late before the deadline', () => expect(isLate(new Date('2026-12-01T22:58:59.999Z'), deadline)).toBe(false));
  it('is not late exactly at the deadline', () => expect(isLate(new Date(deadline), deadline)).toBe(false));
  it('is late after the deadline', () => expect(isLate(new Date('2026-12-01T22:59:00.001Z'), deadline)).toBe(true));
  it('is not late any more once the deadline is extended', () => {
    const submitted = new Date('2026-12-02T08:00:00Z');
    expect(isLate(submitted, deadline)).toBe(true);
    expect(isLate(submitted, new Date('2026-12-05T22:59:00Z'))).toBe(false);
  });
});

describe('folder names', () => {
  it('sanitises Windows-unsafe characters, trailing dots and reserved names', () => {
    expect(safeFolderName('Max Muster')).toBe('Max Muster');
    expect(safeFolderName('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
    expect(safeFolderName('Max. ')).toBe('Max');
    expect(safeFolderName('..')).toBe('Schüler');
    expect(safeFolderName('CON')).toBe('_CON');
    expect(safeFolderName('')).toBe('Schüler');
  });
  it('numbers duplicates, also case-insensitively', () => {
    expect(uniqueFolderNames(['Max', 'Max', 'max', 'Eva', 'Max'])).toEqual(['Max', 'Max (2)', 'max (3)', 'Eva', 'Max (4)']);
  });
});

describe('student hand-in', () => {
  it('requires a student code', async () => {
    expect((await app.request('/api/exercises/ex-a/handins', { method: 'POST', body: '{}' })).status).toBe(401);
    expect((await app.request('/api/exercises/ex-a/handins/latest')).status).toBe(401);
  });

  it('stores a hand-in, the last one counts and the history is kept', async () => {
    const course = await newCourse();
    const [max] = await addStudents(course, ['Max']);
    await unlock(course, 'ex-a');
    const call = asStudent(max!.code);

    const before = Date.now();
    const r1 = await call('POST', '/api/exercises/ex-a/handins', {
      files: [main('v1')],
      testSummary: null,
      submittedAt: '2000-01-01T00:00:00Z', // ignored
    });
    expect(r1.status).toBe(201);
    const b1 = await json(r1);
    expect(b1.late).toBe(false);
    expect(Date.parse(b1.submittedAt)).toBeGreaterThanOrEqual(before - 1000);

    const r2 = await call('POST', '/api/exercises/ex-a/handins', {
      files: [main('v2'), { path: 'util/Helper.java', content: 'h' }],
      testSummary: { passed: 2, total: 3 },
    });
    expect(r2.status).toBe(201);

    const latest = await json(await call('GET', '/api/exercises/ex-a/handins/latest'));
    expect(latest.files).toEqual([main('v2'), { path: 'util/Helper.java', content: 'h' }]);

    const rows = await t.current().db<{ n: number }[]>`SELECT COUNT(*) AS n FROM handins WHERE student_id = ${max!.id}`;
    expect(Number(rows[0]!.n)).toBe(2);
    const files = await t.current().db<{ n: number }[]>`SELECT COUNT(*) AS n FROM handin_files hf JOIN handins h ON h.id = hf.handin_id WHERE h.student_id = ${max!.id}`;
    expect(Number(files[0]!.n)).toBe(3);
  });

  it('404 for a hidden or unknown exercise and for a never-unlocked course', async () => {
    const course = await newCourse();
    const [max] = await addStudents(course, ['Max']);
    const call = asStudent(max!.code);
    for (const id of ['ex-b', 'nope']) {
      const res = await call('POST', `/api/exercises/${id}/handins`, { files: [main('x')], testSummary: null });
      expect(res.status).toBe(404);
      expect((await json(res)).message).toMatch(/nicht verfügbar/);
      expect((await call('GET', `/api/exercises/${id}/handins/latest`)).status).toBe(404);
    }
  });

  it('rejects unknown and read-only paths with a German 400', async () => {
    const course = await newCourse();
    const [max] = await addStudents(course, ['Max']);
    await unlock(course, 'ex-a');
    const call = asStudent(max!.code);
    for (const p of ['Given.java', 'Other.java', '../Main.java', 'exercise.yaml']) {
      const res = await call('POST', '/api/exercises/ex-a/handins', { files: [main('ok'), { path: p, content: 'x' }], testSummary: null });
      expect(res.status, p).toBe(400);
      expect((await json(res)).message).toMatch(/Datei/);
    }
    const dup = await call('POST', '/api/exercises/ex-a/handins', { files: [main('a'), main('b')], testSummary: null });
    expect(dup.status).toBe(400);
    const none = await call('POST', '/api/exercises/ex-a/handins', { files: [], testSummary: null });
    expect(none.status).toBe(400);
    // nothing was stored
    expect((await call('GET', '/api/exercises/ex-a/handins/latest')).status).toBe(404);
  });

  it('enforces the size limits', async () => {
    const course = await newCourse();
    const [max] = await addStudents(course, ['Max']);
    await unlock(course, 'ex-a');
    const call = asStudent(max!.code);
    const tooMany = Array.from({ length: MAX_HANDIN_FILES + 1 }, (_, i) => ({ path: `F${i}.java`, content: '' }));
    const r1 = await call('POST', '/api/exercises/ex-a/handins', { files: tooMany, testSummary: null });
    expect(r1.status).toBe(400);
    expect((await json(r1)).message).toMatch(/Zu viele Dateien/);

    const big = 'ä'.repeat(MAX_HANDIN_BYTES / 2 + 1); // 2 bytes each -> just over 1 MB
    const r2 = await call('POST', '/api/exercises/ex-a/handins', { files: [main(big)], testSummary: null });
    expect(r2.status).toBe(413);
    expect((await json(r2)).message).toMatch(/zu groß/);

    const ok = await call('POST', '/api/exercises/ex-a/handins', { files: [main('a'.repeat(MAX_HANDIN_BYTES))], testSummary: null });
    expect(ok.status).toBe(201);
  });

  it('validates the test summary shape when present', async () => {
    const course = await newCourse();
    const [max] = await addStudents(course, ['Max']);
    await unlock(course, 'ex-a');
    const call = asStudent(max!.code);
    for (const bad of [{ passed: 4, total: 3 }, { passed: -1, total: 3 }, { passed: 1.5, total: 3 }, { passed: 1 }, 'x']) {
      expect((await call('POST', '/api/exercises/ex-a/handins', { files: [main('a')], testSummary: bad })).status).toBe(400);
    }
    expect((await call('POST', '/api/exercises/ex-a/handins', { files: [main('a')] })).status).toBe(201); // omitted = null
    expect((await call('POST', '/api/exercises/ex-a/handins', { files: [main('a')], testSummary: { passed: 3, total: 3 } })).status).toBe(201);
  });

  it('marks hand-ins after the deadline as late', async () => {
    const course = await newCourse();
    const [max] = await addStudents(course, ['Max']);
    const call = asStudent(max!.code);
    await unlock(course, 'ex-a', '2000-01-01T00:00:00Z');
    expect((await json(await call('POST', '/api/exercises/ex-a/handins', { files: [main('a')], testSummary: null }))).late).toBe(true);
    await unlock(course, 'ex-a', '2999-01-01T00:00:00Z');
    expect((await json(await call('POST', '/api/exercises/ex-a/handins', { files: [main('a')], testSummary: null }))).late).toBe(false);
  });

  it('restores the latest hand-in; 404 when there is none; students are isolated', async () => {
    const course = await newCourse();
    const [max, eva] = await addStudents(course, ['Max', 'Eva']);
    await unlock(course, 'ex-a');
    expect((await asStudent(max!.code)('GET', '/api/exercises/ex-a/handins/latest')).status).toBe(404);
    await asStudent(max!.code)('POST', '/api/exercises/ex-a/handins', { files: [main('max')], testSummary: null });
    const mine = await json(await asStudent(max!.code)('GET', '/api/exercises/ex-a/handins/latest'));
    expect(mine.files).toEqual([main('max')]);
    expect(typeof mine.submittedAt).toBe('string');
    expect((await asStudent(eva!.code)('GET', '/api/exercises/ex-a/handins/latest')).status).toBe(404);
  });
});

describe('teacher views', () => {
  let course: number;
  let students: { id: number; name: string; code: string }[];
  let lateId: number;

  beforeAll(async () => {
    course = await newCourse();
    students = await addStudents(course, ['Zoe', 'Anton', 'Mia']); // sorted: Anton, Mia, Zoe
    await unlock(course, 'ex-a', '2999-01-01T00:00:00Z');
    await unlock(course, 'ex-b');
    const [anton, zoe] = [students[0]!, students[2]!];
    const post = (s: { code: string }, ex: string, content: string, ts: unknown = null) =>
      asStudent(s.code)('POST', `/api/exercises/${ex}/handins`, { files: [main(content)], testSummary: ts });
    await post(zoe, 'ex-a', 'zoe1');
    await post(zoe, 'ex-a', 'zoe2', { passed: 1, total: 4 });
    await post(anton, 'ex-a', 'anton1', { passed: 3, total: 3 });
    await post(anton, 'ex-b', 'anton-b');
    // Mia: nothing. Make Zoe's hand-ins late by moving the deadline into the past.
    await unlock(course, 'ex-a', '2000-01-01T00:00:00Z');
    lateId = (await t.current().db<{ id: number }[]>`SELECT MAX(id) AS id FROM handins WHERE student_id = ${zoe.id}`)[0]!.id;
  });

  it('builds the matrix with last hand-ins, late flag and counts', async () => {
    const m = await json(await anna.call('GET', `/api/teacher/courses/${course}/handins`));
    expect(m.exercises.map((e: any) => e.id)).toEqual(['ex-a', 'ex-b']);
    expect(m.exercises[0].deadline).toBe('2000-01-01T00:00:00.000Z');
    expect(m.students.map((s: any) => s.name)).toEqual(['Anton', 'Mia', 'Zoe']);
    const byName = Object.fromEntries(m.students.map((s: any, i: number) => [s.name, m.rows[i].cells]));
    expect(byName.Mia).toEqual([null, null]);
    expect(byName.Zoe[0]).toMatchObject({ late: true, count: 2, testSummary: { passed: 1, total: 4 }, handinId: lateId });
    expect(byName.Zoe[1]).toBeNull();
    expect(byName.Anton[0]).toMatchObject({ late: true, count: 1, testSummary: { passed: 3, total: 3 } });
    expect(byName.Anton[1]).toMatchObject({ late: false, count: 1, testSummary: null });

    // extending the deadline un-marks late
    await unlock(course, 'ex-a', '2999-01-01T00:00:00Z');
    const m2 = await json(await anna.call('GET', `/api/teacher/courses/${course}/handins`));
    expect(m2.rows[2].cells[0].late).toBe(false);
  });

  it('?missing=1 keeps only students lacking a hand-in', async () => {
    const m = await json(await anna.call('GET', `/api/teacher/courses/${course}/handins?missing=1`));
    // Anton handed in both unlocked exercises; Mia and Zoe each lack at least one.
    expect(m.students.map((s: any) => s.name)).toEqual(['Mia', 'Zoe']);
    expect(m.rows).toHaveLength(2);
    expect(m.exercises).toHaveLength(2);
  });

  it('shows the detail with history, files and previous/next students', async () => {
    const m = await json(await anna.call('GET', `/api/teacher/courses/${course}/handins`));
    const zoeCell = m.rows[2].cells[0];
    const d = (await json(await anna.call('GET', `/api/teacher/handins/${zoeCell.handinId}`))).handin;
    expect(d).toMatchObject({
      student: { name: 'Zoe' },
      exercise: { id: 'ex-a', title: 'Aufgabe ex-a' },
      testSummary: { passed: 1, total: 4 },
      files: [main('zoe2')],
    });
    expect(d.history).toHaveLength(2);
    expect(d.history[0].id).toBe(zoeCell.handinId);
    expect(d.history[0].id).toBeGreaterThan(d.history[1].id);
    // Mia has no hand-in for ex-a, so Anton is Zoe's predecessor.
    expect(d.previous).toEqual({ studentId: students[0]!.id, handinId: m.rows[0].cells[0].handinId });
    expect(d.next).toBeNull();

    const a = (await json(await anna.call('GET', `/api/teacher/handins/${m.rows[0].cells[0].handinId}`))).handin;
    expect(a.previous).toBeNull();
    expect(a.next).toMatchObject({ studentId: students[2]!.id });
  });

  it('is owner-isolated (404 for another teacher)', async () => {
    const m = await json(await anna.call('GET', `/api/teacher/courses/${course}/handins`));
    expect((await ben.call('GET', `/api/teacher/courses/${course}/handins`)).status).toBe(404);
    expect((await ben.call('GET', `/api/teacher/handins/${m.rows[2].cells[0].handinId}`)).status).toBe(404);
    expect((await ben.call('GET', `/api/teacher/courses/${course}/exercises/ex-a/handins.zip`)).status).toBe(404);
    expect((await anna.call('GET', '/api/teacher/handins/999999')).status).toBe(404);
    expect((await anna.call('GET', '/api/teacher/handins/abc')).status).toBe(404);
    expect((await app.request(`/api/teacher/courses/${course}/handins`)).status).toBe(401);
  });

  it('zips the last hand-ins with one folder per student', async () => {
    const res = await anna.call('GET', `/api/teacher/courses/${course}/exercises/ex-a/handins.zip`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual(['Anton/Main.java', 'Zoe/Main.java']);
    expect(strFromU8(files['Zoe/Main.java']!)).toBe('zoe2');
    expect((await anna.call('GET', `/api/teacher/courses/${course}/exercises/nope/handins.zip`)).status).toBe(404);
  });

  it('names zip folders safely, with duplicates numbered', async () => {
    const c = await newCourse();
    const sts = await addStudents(c, ['Max/Muster', 'Max/Muster ', 'Max*Muster', 'Anna?']);
    await unlock(c, 'ex-a');
    for (const s of sts) await asStudent(s.code)('POST', '/api/exercises/ex-a/handins', { files: [main(s.name)], testSummary: null });
    const res = await anna.call('GET', `/api/teacher/courses/${c}/exercises/ex-a/handins.zip`);
    const names = Object.keys(unzipSync(new Uint8Array(await res.arrayBuffer()))).sort();
    expect(names).toEqual(['Anna_/Main.java', 'Max_Muster (2)/Main.java', 'Max_Muster (3)/Main.java', 'Max_Muster/Main.java']);
  });

  it('fills handInCount / unlockedExerciseCount in the student list (unlocked exercises only)', async () => {
    const list = async () => (await json(await anna.call('GET', `/api/teacher/courses/${course}/students`))).students as any[];
    let byName = Object.fromEntries((await list()).map((s) => [s.name, s]));
    expect(byName.Zoe).toMatchObject({ handInCount: 1, unlockedExerciseCount: 2 });
    expect(byName.Anton).toMatchObject({ handInCount: 2, unlockedExerciseCount: 2 });
    expect(byName.Mia).toMatchObject({ handInCount: 0, unlockedExerciseCount: 2 });
    await anna.call('PUT', `/api/teacher/courses/${course}/exercises/ex-b`, { unlocked: false });
    byName = Object.fromEntries((await list()).map((s) => [s.name, s]));
    expect(byName.Anton).toMatchObject({ handInCount: 1, unlockedExerciseCount: 1 });
  });
});
