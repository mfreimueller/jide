import { beforeAll, describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { app } from '../src/app.js';
import { createSession } from '../src/lib/teacher_auth.js';
import { signedInTeacher, useTestDb, type TestTeacher } from './helpers.js';

const t = useTestDb();
const json = async (res: Response) => (await res.json()) as any;

const pkg = (id: string) =>
  zipSync({
    'exercise.yaml': strToU8(`id: ${id}\ntitle: Aufgabe ${id}\nfiles:\n  - path: Main.java\nmainFile: Main.java\n`),
    'aufgabe.md': strToU8('# x'),
    'files/Main.java': strToU8('class Main {}'),
  });

let anna: TestTeacher;
let ben: TestTeacher;
let annaKey: string;
let courseId: number;
let otherCourseId: number;
let students: { id: number; name: string; code: string }[];
const stu = (name: string) => students.find((s) => s.name === name)!;
const bearer = (k: string) => (method: string, p: string, body?: unknown) =>
  app.request(p, {
    method,
    headers: { Authorization: `Bearer ${k}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const hand = (code: string, ex: string, content = 'class Main {}') =>
  bearer(code)('POST', `/api/exercises/${ex}/handins`, { files: [{ path: 'Main.java', content }], testSummary: null });
async function latestHandin(studentId: number, exId: string): Promise<number> {
  const m = await json(await anna.call('GET', `/api/teacher/courses/${courseId}/handins`));
  const j = m.exercises.findIndex((e: any) => e.id === exId);
  return m.rows[m.students.findIndex((s: any) => s.id === studentId)].cells[j].handinId;
}
const grade = (handinId: number, symbol = 'PLUS_WELLE', lineComments: unknown[] = [{ path: 'Main.java', line: 1, text: 'Hier.' }]) =>
  bearer(annaKey)('PUT', `/api/v1/handins/${handinId}/grade`, { symbol, comment: 'Gut.', lineComments });

beforeAll(async () => {
  const db = t.current().db;
  anna = await signedInTeacher(db, 'anna@school.edu', 'Anna');
  ben = await signedInTeacher(db, 'ben@school.edu', 'Ben');
  const { token } = await createSession(db, anna.id);
  annaKey = (await json(await anna.call('POST', '/api/teacher/api-keys', { name: 'k' }))).key;
  for (const id of ['ex-a', 'ex-b', 'ex-c']) {
    const res = await app.request('/api/teacher/exercises', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/zip' },
      body: pkg(id) as RequestInit['body'],
    });
    expect(res.status).toBe(201);
  }
  courseId = (await json(await anna.call('POST', '/api/teacher/courses', { subject: 'POS', className: '3AHIF' }))).course.id;
  otherCourseId = (await json(await anna.call('POST', '/api/teacher/courses', { subject: 'POS', className: '4AHIF' }))).course.id;
  students = (await json(await anna.call('POST', `/api/teacher/courses/${courseId}/students`, { names: 'Ada\nMax\nZoe' }))).students;
  for (const ex of ['ex-a', 'ex-b']) await anna.call('PUT', `/api/teacher/courses/${courseId}/exercises/${ex}`, { unlocked: true });
  await anna.call('PUT', `/api/teacher/courses/${courseId}/exercises/ex-c`, { unlocked: false });
  expect((await hand(stu('Ada').code, 'ex-a')).status).toBe(201);
  expect((await hand(stu('Max').code, 'ex-a')).status).toBe(201);
  expect((await hand(stu('Max').code, 'ex-b')).status).toBe(201);
});

describe('matrix: ungraded', () => {
  it('has default hideGraded true, no grades, gradedCount 0, no override', async () => {
    const m = await json(await anna.call('GET', `/api/teacher/courses/${courseId}/handins`));
    expect(m.hideGraded).toBe(true);
    expect(m.exercises).toHaveLength(2);
    for (const e of m.exercises) {
      expect(e.gradedCount).toBe(0);
      expect(e.visibility).toBeNull();
      expect(e.unlockedAt).toMatch(/^\d{4}-.*Z$/);
    }
    for (const r of m.rows) for (const c of r.cells) if (c) expect(c.grade).toBeNull();
  });

  it('detail: grade null and graded false in the history', async () => {
    const d = await json(await anna.call('GET', `/api/teacher/handins/${await latestHandin(stu('Ada').id, 'ex-a')}`));
    expect(d.handin.grade).toBeNull();
    expect(d.handin.history.every((h: any) => h.graded === false)).toBe(true);
  });
});

describe('graded', () => {
  it('shows grades in the matrix, counts per exercise and the grade on the detail page', async () => {
    const maxA = await latestHandin(stu('Max').id, 'ex-a');
    expect((await grade(maxA, 'MINUS_WELLE')).status).toBe(200);
    const m = await json(await anna.call('GET', `/api/teacher/courses/${courseId}/handins`));
    const colA = m.exercises.findIndex((e: any) => e.id === 'ex-a');
    const colB = m.exercises.findIndex((e: any) => e.id === 'ex-b');
    expect(m.exercises[colA].gradedCount).toBe(1);
    expect(m.exercises[colB].gradedCount).toBe(0);
    const row = (name: string) => m.rows[m.students.findIndex((s: any) => s.name === name)];
    expect(row('Max').cells[colA].grade).toEqual({ symbol: 'MINUS_WELLE', gradedAt: expect.stringMatching(/^\d{4}-.*Z$/) });
    expect(row('Max').cells[colB].grade).toBeNull();
    expect(row('Ada').cells[colA].grade).toBeNull();

    const d = await json(await anna.call('GET', `/api/teacher/handins/${maxA}`));
    expect(d.handin.grade).toEqual({
      symbol: 'MINUS_WELLE',
      comment: 'Gut.',
      gradedAt: expect.any(String),
      lineComments: [{ path: 'Main.java', line: 1, text: 'Hier.' }],
    });
    expect(d.handin.history).toEqual([expect.objectContaining({ id: maxA, graded: true })]);
  });

  it('counts each graded hand-in once, even after a re-grade', async () => {
    expect((await grade(await latestHandin(stu('Max').id, 'ex-a'), 'PLUS')).status).toBe(200);
    expect((await grade(await latestHandin(stu('Ada').id, 'ex-a'), 'WELLE', [])).status).toBe(200);
    const m = await json(await anna.call('GET', `/api/teacher/courses/${courseId}/handins`));
    expect(m.exercises.find((e: any) => e.id === 'ex-a').gradedCount).toBe(2);
    const list = await json(await anna.call('GET', `/api/teacher/courses/${courseId}/exercises`));
    const byId = (id: string) => list.exercises.find((e: any) => e.id === id);
    expect(byId('ex-a').gradedCount).toBe(2);
    expect(byId('ex-b').gradedCount).toBe(0);
    expect(byId('ex-c').gradedCount).toBe(0);
    const other = await json(await anna.call('GET', `/api/teacher/courses/${otherCourseId}/exercises`));
    expect(other.exercises.find((e: any) => e.id === 'ex-a').gradedCount).toBe(0);
  });
});

describe('PUT matrix-settings', () => {
  it('stores hideGraded per course', async () => {
    const res = await anna.call('PUT', `/api/teacher/courses/${courseId}/matrix-settings`, { hideGraded: false });
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ hideGraded: false });
    expect((await json(await anna.call('GET', `/api/teacher/courses/${courseId}/handins`))).hideGraded).toBe(false);
    expect((await json(await anna.call('GET', `/api/teacher/courses/${otherCourseId}/handins`))).hideGraded).toBe(true);
    await anna.call('PUT', `/api/teacher/courses/${courseId}/matrix-settings`, { hideGraded: true });
    expect((await json(await anna.call('GET', `/api/teacher/courses/${courseId}/handins`))).hideGraded).toBe(true);
  });

  it('validates in German and hides foreign courses', async () => {
    const bad = await anna.call('PUT', `/api/teacher/courses/${courseId}/matrix-settings`, { hideGraded: 'ja' });
    expect(bad.status).toBe(400);
    expect((await json(bad)).message).toMatch(/true oder false/);
    expect((await ben.call('PUT', `/api/teacher/courses/${courseId}/matrix-settings`, { hideGraded: false })).status).toBe(404);
    expect((await anna.call('PUT', '/api/teacher/courses/999999/matrix-settings', { hideGraded: false })).status).toBe(404);
  });
});

describe('PUT exercise visibility', () => {
  const put = (ex: string, visibility: unknown, who = anna, cid = courseId) =>
    who.call('PUT', `/api/teacher/courses/${cid}/exercises/${ex}/visibility`, { visibility });
  const visibilityOf = async (ex: string) =>
    (await json(await anna.call('GET', `/api/teacher/courses/${courseId}/handins`))).exercises.find((e: any) => e.id === ex).visibility;

  it('sets hidden, shown and back to null', async () => {
    for (const v of ['hidden', 'shown', null]) {
      const res = await put('ex-a', v);
      expect(res.status).toBe(200);
      expect(await json(res)).toEqual({ visibility: v });
      expect(await visibilityOf('ex-a')).toBe(v);
    }
    expect(await visibilityOf('ex-b')).toBeNull();
  });

  it('rejects other values in German', async () => {
    const res = await put('ex-a', 'weg');
    expect(res.status).toBe(400);
    expect((await json(res)).message).toMatch(/hidden/);
  });

  it('404 for a foreign teacher, foreign course, unknown exercise or exercise not linked to the course', async () => {
    expect((await put('ex-a', 'hidden', ben)).status).toBe(404);
    expect((await put('nope', 'hidden')).status).toBe(404);
    expect((await put('ex-a', 'hidden', anna, 999999)).status).toBe(404);
    expect((await put('ex-a', 'hidden', anna, otherCourseId)).status).toBe(404);
    expect(await visibilityOf('ex-a')).toBeNull();
  });
});
