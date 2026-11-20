import { beforeAll, describe, expect, it } from 'vitest';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { app } from '../src/app.js';
import { createSession } from '../src/lib/teacher_auth.js';
import { signedInTeacher, useTestDb, type TestTeacher } from './helpers.js';

const t = useTestDb();

const YAML = (id: string) =>
  `id: ${id}\ntitle: Aufgabe ${id}\ndifficulty: advanced\nfiles:\n  - path: Main.java\n  - path: util/Helper.java\nmainFile: Main.java\n`;
const pkg = (id: string) =>
  zipSync({
    'exercise.yaml': strToU8(YAML(id)),
    'aufgabe.md': strToU8('# x'),
    'files/Main.java': strToU8('class Main {}'),
    'files/util/Helper.java': strToU8('class Helper {}'),
  });

const json = async (res: Response) => (await res.json()) as any;

let anna: TestTeacher;
let ben: TestTeacher;
let annaToken: string;
let annaKey: string;
let benKey: string;
let courseId: number;
let archivedCourseId: number;
let students: { id: number; name: string; code: string }[];
let exA: number; // numeric id of ex-a
let exB: number;

function key(k: string | null) {
  return (method: string, p: string, body?: unknown) =>
    app.request(p, {
      method,
      headers: { ...(k ? { Authorization: `Bearer ${k}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
}
const asStudent = (code: string) => key(code);

async function upload(id: string): Promise<void> {
  const res = await app.request('/api/teacher/exercises', {
    method: 'POST',
    headers: { Authorization: `Bearer ${annaToken}`, 'Content-Type': 'application/zip' },
    body: pkg(id) as RequestInit['body'],
  });
  expect(res.status).toBe(201);
}
async function newKey(teacher: TestTeacher): Promise<string> {
  return (await json(await teacher.call('POST', '/api/teacher/api-keys', { name: 'k' }))).key;
}
const hand = (code: string, ex: string, files = [{ path: 'Main.java', content: 'class Main {}\n// v' }], summary: unknown = { passed: 1, total: 2 }) =>
  asStudent(code)('POST', `/api/exercises/${ex}/handins`, { files, testSummary: summary });

beforeAll(async () => {
  const db = t.current().db;
  anna = await signedInTeacher(db, 'anna@school.edu', 'Anna');
  ben = await signedInTeacher(db, 'ben@school.edu', 'Ben');
  annaToken = (await createSession(db, anna.id)).token;
  annaKey = await newKey(anna);
  benKey = await newKey(ben);
  await upload('ex-a');
  await upload('ex-b');
  courseId = (await json(await anna.call('POST', '/api/teacher/courses', { subject: 'POS', className: '3AHIF' }))).course.id;
  archivedCourseId = (await json(await anna.call('POST', '/api/teacher/courses', { subject: 'POS', className: 'Alt' }))).course.id;
  students = (await json(await anna.call('POST', `/api/teacher/courses/${courseId}/students`, { names: 'Zoe\nAda\nMax\nOtto' }))).students;
  await anna.call('POST', `/api/teacher/courses/${archivedCourseId}/students`, { names: 'Alt Person' });
  await anna.call('PUT', `/api/teacher/courses/${courseId}/exercises/ex-a`, { unlocked: true, deadline: '2030-01-01T00:00:00Z' });
  await anna.call('PUT', `/api/teacher/courses/${courseId}/exercises/ex-b`, { unlocked: false });
  await anna.call('POST', `/api/teacher/courses/${archivedCourseId}/archive`);
  const rows = await db<{ id: number; slug: string }[]>`SELECT id, slug FROM exercises WHERE teacher_id = ${anna.id}`;
  exA = rows.find((r) => r.slug === 'ex-a')!.id;
  exB = rows.find((r) => r.slug === 'ex-b')!.id;
});

describe('apiKeyAuth', () => {
  it('rejects a missing key, a wrong key and a session token', async () => {
    for (const k of [null, 'jide_' + 'x'.repeat(32), annaToken]) {
      const res = await key(k)('GET', '/api/v1/courses');
      expect(res.status).toBe(401);
      const body = await json(res);
      expect(body.error).toBe('UNAUTHORIZED');
      expect(body.message).toMatch(/API-Schlüssel/);
    }
  });

  it('accepts a key and updates last_used_at', async () => {
    const created = await json(await anna.call('POST', '/api/teacher/api-keys', { name: 'nutzen' }));
    expect(created.apiKey.lastUsedAt).toBeNull();
    expect((await key(created.key)('GET', '/api/v1/courses')).status).toBe(200);
    const list = await json(await anna.call('GET', '/api/teacher/api-keys'));
    expect(list.apiKeys.find((k: any) => k.id === created.apiKey.id).lastUsedAt).not.toBeNull();
  });

  it('stops working as soon as the key is revoked', async () => {
    const created = await json(await anna.call('POST', '/api/teacher/api-keys', { name: 'weg' }));
    expect((await key(created.key)('GET', '/api/v1/courses')).status).toBe(200);
    await anna.call('DELETE', `/api/teacher/api-keys/${created.apiKey.id}`);
    const res = await key(created.key)('GET', '/api/v1/courses');
    expect(res.status).toBe(401);
    expect((await json(res)).message).toMatch(/widerrufen/);
  });

  it('covers every /api/v1 route', async () => {
    for (const [m, p] of [
      ['GET', '/api/v1/courses'],
      ['GET', `/api/v1/courses/${courseId}/exercises`],
      ['GET', `/api/v1/exercises/${exA}/package`],
      ['GET', `/api/v1/courses/${courseId}/exercises/${exA}/handins`],
      ['PUT', '/api/v1/handins/1/grade'],
    ] as const) {
      expect((await key(null)(m, p)).status).toBe(401);
    }
  });
});

describe('GET /api/v1/courses', () => {
  it('lists active courses with active students only', async () => {
    const list = await json(await key(annaKey)('GET', '/api/v1/courses'));
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({
      id: courseId,
      subject: 'POS',
      className: '3AHIF',
      students: [
        { id: students.find((s) => s.name === 'Ada')!.id, name: 'Ada' },
        { id: students.find((s) => s.name === 'Max')!.id, name: 'Max' },
        { id: students.find((s) => s.name === 'Otto')!.id, name: 'Otto' },
        { id: students.find((s) => s.name === 'Zoe')!.id, name: 'Zoe' },
      ],
    });
  });

  it('leaves out removed students and shows only the own courses', async () => {
    const extra = (await json(await anna.call('POST', `/api/teacher/courses/${courseId}/students`, { names: 'Weg' }))).students[0];
    await anna.call('DELETE', `/api/teacher/courses/${courseId}/students/${extra.id}`);
    const list = await json(await key(annaKey)('GET', '/api/v1/courses'));
    expect(list[0].students.map((s: any) => s.name)).not.toContain('Weg');
    expect(await json(await key(benKey)('GET', '/api/v1/courses'))).toEqual([]);
  });
});

describe('GET /api/v1/courses/:id/exercises', () => {
  it('lists the unlocked exercises with numeric id and slug', async () => {
    const res = await key(annaKey)('GET', `/api/v1/courses/${courseId}/exercises`);
    expect(res.status).toBe(200);
    const list = await json(res);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: exA, slug: 'ex-a', title: 'Aufgabe ex-a', difficulty: 'advanced', deadline: '2030-01-01T00:00:00.000Z' });
    expect(list[0].unlockedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  });

  it('404s for another teacher, an archived course and nonsense', async () => {
    expect((await key(benKey)('GET', `/api/v1/courses/${courseId}/exercises`)).status).toBe(404);
    expect((await key(annaKey)('GET', `/api/v1/courses/${archivedCourseId}/exercises`)).status).toBe(404);
    expect((await key(annaKey)('GET', '/api/v1/courses/abc/exercises')).status).toBe(404);
    expect((await key(annaKey)('GET', '/api/v1/courses/999999/exercises')).status).toBe(404);
  });
});

describe('GET /api/v1/exercises/:id/package', () => {
  it('serves the same zip as the student download', async () => {
    const res = await key(annaKey)('GET', `/api/v1/exercises/${exA}/package`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    const mine = new Uint8Array(await res.arrayBuffer());
    const student = await asStudent(students[0]!.code)('GET', '/api/exercises/ex-a');
    expect(student.status).toBe(200);
    expect(mine).toEqual(new Uint8Array(await student.arrayBuffer()));
    expect(Object.keys(unzipSync(mine))).toContain('ex-a/exercise.yaml');
  });

  it("404s for another teacher's or an unknown exercise", async () => {
    expect((await key(benKey)('GET', `/api/v1/exercises/${exA}/package`)).status).toBe(404);
    expect((await key(annaKey)('GET', '/api/v1/exercises/999999/package')).status).toBe(404);
    expect((await key(annaKey)('GET', '/api/v1/exercises/x/package')).status).toBe(404);
  });
});

describe('GET handins', () => {
  const url = () => `/api/v1/courses/${courseId}/exercises/${exA}/handins`;

  it('is empty without hand-ins', async () => {
    expect(await json(await key(annaKey)('GET', url()))).toEqual([]);
  });

  it('returns the latest hand-in per student, skips students without one and flags nothing as graded', async () => {
    const ada = students.find((s) => s.name === 'Ada')!;
    const zoe = students.find((s) => s.name === 'Zoe')!;
    expect((await hand(ada.code, 'ex-a', [{ path: 'Main.java', content: 'first' }])).status).toBe(201);
    expect((await hand(ada.code, 'ex-a', [{ path: 'Main.java', content: 'second' }, { path: 'util/Helper.java', content: 'h' }])).status).toBe(201);
    expect((await hand(zoe.code, 'ex-a', undefined, null)).status).toBe(201);
    const list = await json(await key(annaKey)('GET', url()));
    expect(list.map((h: any) => h.studentId)).toEqual([ada.id, zoe.id]);
    expect(list[0]).toMatchObject({
      studentId: ada.id,
      late: false,
      testsPassed: 1,
      testsTotal: 2,
      graded: false,
      files: [
        { path: 'Main.java', content: 'second' },
        { path: 'util/Helper.java', content: 'h' },
      ],
    });
    expect(list[0].submittedAt).toMatch(/^\d{4}-/);
    expect(list[1]).toMatchObject({ studentId: zoe.id, testsPassed: null, testsTotal: null });
    expect(Object.keys(list[0]).sort()).toEqual(['files', 'graded', 'handinId', 'late', 'studentId', 'submittedAt', 'testsPassed', 'testsTotal']);
  });

  it('derives late from the current deadline', async () => {
    await anna.call('PUT', `/api/teacher/courses/${courseId}/exercises/ex-a`, { deadline: '2020-01-01T00:00:00Z' });
    const late = await json(await key(annaKey)('GET', url()));
    expect(late.every((h: any) => h.late)).toBe(true);
    await anna.call('PUT', `/api/teacher/courses/${courseId}/exercises/ex-a`, { deadline: '2030-01-01T00:00:00Z' });
    expect((await json(await key(annaKey)('GET', url()))).some((h: any) => h.late)).toBe(false);
  });

  it('leaves out archived students', async () => {
    const otto = students.find((s) => s.name === 'Otto')!;
    await hand(otto.code, 'ex-a');
    expect((await json(await key(annaKey)('GET', url()))).map((h: any) => h.studentId)).toContain(otto.id);
    await anna.call('DELETE', `/api/teacher/courses/${courseId}/students/${otto.id}`);
    expect((await json(await key(annaKey)('GET', url()))).map((h: any) => h.studentId)).not.toContain(otto.id);
  });

  it('404s for other teachers, archived courses, locked or unknown exercises', async () => {
    expect((await key(benKey)('GET', url())).status).toBe(404);
    expect((await key(annaKey)('GET', `/api/v1/courses/${archivedCourseId}/exercises/${exA}/handins`)).status).toBe(404);
    expect((await key(annaKey)('GET', `/api/v1/courses/${courseId}/exercises/${exB}/handins`)).status).toBe(404);
    expect((await key(annaKey)('GET', `/api/v1/courses/${courseId}/exercises/999999/handins`)).status).toBe(404);
  });
});

describe('PUT /api/v1/handins/:id/grade', () => {
  let handinId: number;
  const grade = (id: number, body: unknown, k: string | null = annaKey) => key(k)('PUT', `/api/v1/handins/${id}/grade`, body);
  const ok = { symbol: 'PLUS_WELLE', comment: 'Gut gemacht.', lineComments: [{ path: 'Main.java', line: 1, text: 'Hier fehlt ein Test.' }] };
  const max = () => students.find((s) => s.name === 'Max')!;

  async function latest(studentId: number) {
    const list = await json(await key(annaKey)('GET', `/api/v1/courses/${courseId}/exercises/${exA}/handins`));
    return list.find((h: any) => h.studentId === studentId);
  }

  beforeAll(async () => {
    expect((await hand(max().code, 'ex-a', [{ path: 'Main.java', content: 'a\nb\nc' }])).status).toBe(201);
    handinId = (await latest(max().id)).handinId;
  });

  it('grades, locks the exercise and exposes the grade to the student', async () => {
    const res = await grade(handinId, ok);
    expect(res.status).toBe(200);
    expect((await json(res)).gradedAt).toMatch(/^\d{4}-.*Z$/);
    expect((await latest(max().id)).graded).toBe(true);

    const list = await json(await asStudent(max().code)('GET', '/api/exercises'));
    const a = list.exercises.find((e: any) => e.id === 'ex-a');
    expect(a.grade).toEqual({ symbol: 'PLUS_WELLE', gradedAt: expect.stringMatching(/^\d{4}-/) });

    const g = await json(await asStudent(max().code)('GET', '/api/exercises/ex-a/grade'));
    expect(g).toMatchObject({
      symbol: 'PLUS_WELLE',
      comment: 'Gut gemacht.',
      handinId,
      files: [{ path: 'Main.java', content: 'a\nb\nc' }],
      lineComments: [{ path: 'Main.java', line: 1, text: 'Hier fehlt ein Test.' }],
    });
    expect(g.submittedAt).toMatch(/^\d{4}-/);
    expect(g.gradedAt).toMatch(/^\d{4}-/);
  });

  it('answers 409 GRADED on a new hand-in of a graded exercise', async () => {
    const res = await hand(max().code, 'ex-a');
    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.error).toBe('GRADED');
    expect(body.message).toBe('Diese Aufgabe ist bereits beurteilt. Du kannst sie nicht mehr abgeben.');
    // other students and other exercises are unaffected
    const ada = students.find((s) => s.name === 'Ada')!;
    expect((await hand(ada.code, 'ex-a')).status).toBe(201);
  });

  it('shows no grade for other students and 404s on /grade when not graded', async () => {
    const zoe = students.find((s) => s.name === 'Zoe')!;
    const list = await json(await asStudent(zoe.code)('GET', '/api/exercises'));
    expect(list.exercises.find((e: any) => e.id === 'ex-a').grade).toBeNull();
    const res = await asStudent(zoe.code)('GET', '/api/exercises/ex-a/grade');
    expect(res.status).toBe(404);
    expect((await asStudent(zoe.code)('GET', '/api/exercises/nope/grade')).status).toBe(404);
    expect((await key(null)('GET', '/api/exercises/ex-a/grade')).status).toBe(401);
  });

  it('replaces the grade and all line comments when graded again', async () => {
    const res = await grade(handinId, { symbol: 'MINUS', comment: '', lineComments: [{ path: 'Main.java', line: 3, text: 'Neu' }, { path: 'Main.java', line: 2, text: 'Zwei' }] });
    expect(res.status).toBe(200);
    const g = await json(await asStudent(max().code)('GET', '/api/exercises/ex-a/grade'));
    expect(g.symbol).toBe('MINUS');
    expect(g.comment).toBe('');
    expect(g.lineComments).toEqual([
      { path: 'Main.java', line: 3, text: 'Neu' },
      { path: 'Main.java', line: 2, text: 'Zwei' },
    ]);
    const rows = await t.current().db<{ n: number }[]>`SELECT COUNT(*) AS n FROM grades WHERE student_id = ${max().id}`;
    expect(Number(rows[0]!.n)).toBe(1);
    await grade(handinId, { symbol: 'PLUS', comment: 'x', lineComments: [] });
    expect((await json(await asStudent(max().code)('GET', '/api/exercises/ex-a/grade'))).lineComments).toEqual([]);
  });

  it('answers 409 NEWER_HANDIN when the student handed in again', async () => {
    const zoe = students.find((s) => s.name === 'Zoe')!;
    const old = (await latest(zoe.id)).handinId;
    expect((await hand(zoe.code, 'ex-a', [{ path: 'Main.java', content: 'newer' }])).status).toBe(201);
    const res = await grade(old, ok);
    expect(res.status).toBe(409);
    expect((await json(res)).error).toBe('NEWER_HANDIN');
    const rows = await t.current().db<{ n: number }[]>`SELECT COUNT(*) AS n FROM grades WHERE student_id = ${zoe.id}`;
    expect(Number(rows[0]!.n)).toBe(0);
    expect((await grade((await latest(zoe.id)).handinId, ok)).status).toBe(200);
  });

  it("404s for another teacher's, an archived student's and an unknown hand-in", async () => {
    const fresh = (await latest(students.find((s) => s.name === 'Ada')!.id)).handinId;
    expect((await grade(fresh, ok, benKey)).status).toBe(404);
    expect((await grade(999999, ok)).status).toBe(404);
    expect((await grade('abc' as any, ok)).status).toBe(404);
    const rows = await t.current().db<{ id: number }[]>`SELECT MAX(h.id) AS id FROM handins h JOIN students s ON s.id = h.student_id WHERE s.name = 'Otto'`;
    expect((await grade(rows[0]!.id, ok)).status).toBe(404); // Otto was removed (archived)
  });

  it('validates the body', async () => {
    const ada = (await latest(students.find((s) => s.name === 'Ada')!.id)).handinId;
    const bad: [string, unknown][] = [
      ['unknown symbol', { ...ok, symbol: 'PLUSPLUS' }],
      ['missing symbol', { comment: '', lineComments: [] }],
      ['lowercase symbol', { ...ok, symbol: 'plus' }],
      ['comment too long', { ...ok, comment: 'x'.repeat(2001) }],
      ['comment not a string', { ...ok, comment: 5 }],
      ['lineComments missing', { symbol: 'PLUS', comment: '' }],
      ['too many line comments', { ...ok, lineComments: Array.from({ length: 201 }, () => ({ path: 'Main.java', line: 1, text: 'x' })) }],
      ['empty text', { ...ok, lineComments: [{ path: 'Main.java', line: 1, text: '' }] }],
      ['text too long', { ...ok, lineComments: [{ path: 'Main.java', line: 1, text: 'x'.repeat(1001) }] }],
      ['line 0', { ...ok, lineComments: [{ path: 'Main.java', line: 0, text: 'x' }] }],
      ['line fractional', { ...ok, lineComments: [{ path: 'Main.java', line: 1.5, text: 'x' }] }],
      ['line string', { ...ok, lineComments: [{ path: 'Main.java', line: '1', text: 'x' }] }],
    ];
    for (const [label, body] of bad) {
      const res = await grade(ada, body);
      expect(res.status, label).toBe(400);
      expect((await json(res)).error, label).toBe('VALIDATION');
    }
    // limits are inclusive
    const edge = { symbol: 'WELLE', comment: 'x'.repeat(2000), lineComments: Array.from({ length: 200 }, () => ({ path: 'Main.java', line: 1, text: 'y'.repeat(1000) })) };
    expect((await grade(ada, edge)).status).toBe(200);
    expect((await app.request(`/api/v1/handins/${ada}/grade`, { method: 'PUT', headers: { Authorization: `Bearer ${annaKey}` }, body: 'nope' })).status).toBe(400);
  });

  it('rejects a path that is not a file of the hand-in', async () => {
    const ada = (await latest(students.find((s) => s.name === 'Ada')!.id)).handinId;
    const res = await grade(ada, { ...ok, lineComments: [{ path: 'Other.java', line: 1, text: 'x' }] });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe('INVALID_PATH');
    const before = await json(await asStudent(students.find((s) => s.name === 'Ada')!.code)('GET', '/api/exercises/ex-a/grade'));
    expect(before.symbol).toBe('WELLE'); // the failed request did not change the earlier grade
  });

  it('removes grades with the exercise (cascade)', async () => {
    await anna.call('DELETE', '/api/teacher/exercises/ex-a');
    const rows = await t.current().db<{ n: number }[]>`SELECT (SELECT COUNT(*) FROM grades) + (SELECT COUNT(*) FROM grade_comments) AS n`;
    expect(Number(rows[0]!.n)).toBe(0);
  });
});
