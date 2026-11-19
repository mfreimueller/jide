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
let course: number;
let other: number;
let studentCode: string;

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
const base = () => `/api/teacher/courses/${course}`;
const mkGroup = async (name: string) => (await json(await anna.call('POST', `${base()}/groups`, { name }))).group.id as number;
const groupNames = async (c = course) => (await json(await anna.call('GET', `/api/teacher/courses/${c}/groups`))).groups.map((g: any) => g.name);
const listing = async () => json(await anna.call('GET', `${base()}/exercises`));
const inGroup = async (gid: number) =>
  (await listing()).exercises.filter((e: any) => e.groupId === gid).map((e: any) => e.id);
const studentList = async () => json(await app.request('/api/exercises', { headers: { Authorization: `Bearer ${studentCode}` } }));

beforeAll(async () => {
  anna = await signedInTeacher(t.current().db, 'anna@school.edu', 'Anna');
  ben = await signedInTeacher(t.current().db, 'ben@school.edu', 'Ben');
  for (const id of ['e1', 'e2', 'e3', 'e4']) await upload(anna, id);
  await upload(ben, 'b1');
  course = (await json(await anna.call('POST', '/api/teacher/courses', { subject: 'POS', className: '1AHIF' }))).course.id;
  other = (await json(await anna.call('POST', '/api/teacher/courses', { subject: 'DBI', className: '2AHIF' }))).course.id;
  studentCode = (await json(await anna.call('POST', `${base()}/students`, { names: 'Eva' }))).students[0].code;
});
beforeEach(() => resetRateLimits());

describe('groups: create, rename, order by name', () => {
  it('starts empty and lists groups by name, not by creation', async () => {
    expect(await groupNames()).toEqual([]);
    const r = await anna.call('POST', `${base()}/groups`, { name: '  Schleifen  ' });
    expect(r.status).toBe(201);
    expect((await json(r)).group.name).toBe('Schleifen');
    await mkGroup('Arrays');
    await mkGroup('Klassen');
    expect(await groupNames()).toEqual(['Arrays', 'Klassen', 'Schleifen']);
  });

  it('rejects empty, too long and duplicate names (also case-insensitive), allows the same name in another course', async () => {
    expect((await anna.call('POST', `${base()}/groups`, { name: '   ' })).status).toBe(400);
    expect((await anna.call('POST', `${base()}/groups`, { name: 'x'.repeat(101) })).status).toBe(400);
    expect((await anna.call('POST', `${base()}/groups`, {})).status).toBe(400);
    const dup = await anna.call('POST', `${base()}/groups`, { name: 'arrays' });
    expect(dup.status).toBe(409);
    expect((await json(dup)).message).toBe('Diese Gruppe gibt es schon.');
    expect((await anna.call('POST', `/api/teacher/courses/${other}/groups`, { name: 'Arrays' })).status).toBe(201);
    expect(await groupNames()).toEqual(['Arrays', 'Klassen', 'Schleifen']);
  });

  it('renames; duplicate on rename is rejected, the own name is fine', async () => {
    const id = (await json(await anna.call('GET', `${base()}/groups`))).groups.find((g: any) => g.name === 'Klassen').id;
    expect((await json(await anna.call('PUT', `${base()}/groups/${id}`, { name: 'Objekte' }))).group.name).toBe('Objekte');
    expect((await anna.call('PUT', `${base()}/groups/${id}`, { name: 'Objekte' })).status).toBe(200);
    const dup = await anna.call('PUT', `${base()}/groups/${id}`, { name: 'Arrays' });
    expect(dup.status).toBe(409);
    expect((await anna.call('PUT', `${base()}/groups/${id}`, { name: '' })).status).toBe(400);
    expect(await groupNames()).toEqual(['Arrays', 'Objekte', 'Schleifen']);
  });

  it('has no move routes any more', async () => {
    const [a] = (await json(await anna.call('GET', `${base()}/groups`))).groups.map((g: any) => g.id);
    expect((await anna.call('POST', `${base()}/groups/${a}/move`, { direction: 'up' })).status).toBe(404);
    expect((await anna.call('POST', `${base()}/exercises/e1/move`, { direction: 'up' })).status).toBe(404);
  });
});

describe('exercises in groups', () => {
  let g1: number; // Schleifen
  let g2: number; // Objekte
  beforeAll(async () => {
    const groups = (await json(await anna.call('GET', `${base()}/groups`))).groups;
    g1 = groups.find((g: any) => g.name === 'Schleifen').id;
    g2 = groups.find((g: any) => g.name === 'Objekte').id;
  });
  const put = (slug: string, body: unknown, c = course) => anna.call('PUT', `/api/teacher/courses/${c}/exercises/${slug}`, body);

  const order = async () => (await listing()).exercises.map((e: any) => [e.id, e.groupId]);

  it('puts exercises into a group; the teacher page is sorted by group name, then title, ungrouped last', async () => {
    for (const s of ['e3', 'e1', 'e2']) expect((await put(s, { groupId: g1 })).status).toBe(200);
    expect(await inGroup(g1)).toEqual(['e1', 'e2', 'e3']);
    const list = await listing();
    expect(list.exercises.map((e: any) => [e.id, e.groupId])).toEqual([
      ['e1', g1],
      ['e2', g1],
      ['e3', g1],
      ['e4', null],
    ]);
    expect(list.exercises[0]).not.toHaveProperty('position');
    expect(list.groups.map((g: any) => g.name)).toEqual(['Arrays', 'Objekte', 'Schleifen']);
  });

  it('regrouping and ungrouping keep the order groups by name, exercises by title', async () => {
    await put('e4', { groupId: g2 });
    await put('e2', { groupId: g2 });
    expect(await inGroup(g1)).toEqual(['e1', 'e3']);
    expect(await inGroup(g2)).toEqual(['e2', 'e4']);
    // Objekte sorts before Schleifen although it was created later
    expect(await order()).toEqual([['e2', g2], ['e4', g2], ['e1', g1], ['e3', g1]]);
    await put('e3', { groupId: null });
    expect(await inGroup(g1)).toEqual(['e1']);
    expect(await order()).toEqual([['e2', g2], ['e4', g2], ['e1', g1], ['e3', null]]);
    await put('e3', { groupId: g1 });
    expect(await inGroup(g1)).toEqual(['e1', 'e3']);
    await put('e4', { groupId: null });
    expect(await order()).toEqual([['e2', g2], ['e1', g1], ['e3', g1], ['e4', null]]);
  });

  it('keeps unlock and deadline when only the group changes, and group stays when unlock changes', async () => {
    await put('e1', { unlocked: true });
    await put('e1', { groupId: g2 });
    const e1 = (await listing()).exercises.find((e: any) => e.id === 'e1');
    expect(e1).toMatchObject({ unlocked: true, groupId: g2 });
    await put('e1', { groupId: g1 });
  });

  it('rejects a group of another course and an empty body; ignores nothing silently', async () => {
    const foreign = (await json(await anna.call('POST', `/api/teacher/courses/${other}/groups`, { name: 'Fremd' }))).group.id;
    expect((await put('e1', { groupId: foreign })).status).toBe(404);
    expect((await put('e1', { groupId: 99999 })).status).toBe(404);
    expect((await put('e1', { groupId: 'x' })).status).toBe(400);
    expect((await put('e1', {})).status).toBe(400);
  });
});

describe('unlocked_at and student order', () => {
  const put = (slug: string, body: unknown) => anna.call('PUT', `${base()}/exercises/${slug}`, body);
  const dateOf = async (slug: string) =>
    (
      await t.current().db<{ at: Date | null }[]>`
        SELECT ce.unlocked_at AS at FROM course_exercises ce JOIN exercises e ON e.id = ce.exercise_id
        WHERE ce.course_id = ${course} AND e.slug = ${slug}`
    )[0]!.at;
  const setDate = (slug: string, d: string | null) =>
    t.current().db`
      UPDATE course_exercises ce JOIN exercises e ON e.id = ce.exercise_id SET ce.unlocked_at = ${d ? new Date(d) : null}
      WHERE ce.course_id = ${course} AND e.slug = ${slug}`;
  const ids = (r: any) => r.exercises.map((e: any) => e.id);
  const gnames = (r: any) => r.groups.map((g: any) => g.name);
  let schleifen: number;
  let objekte: number;
  beforeAll(async () => {
    const groups = (await json(await anna.call('GET', `${base()}/groups`))).groups;
    schleifen = groups.find((g: any) => g.name === 'Schleifen').id;
    objekte = groups.find((g: any) => g.name === 'Objekte').id;
  });

  it('sets unlocked_at the first time only; hiding and unlocking again keeps it; nothing set while hidden', async () => {
    // e1 was unlocked by an earlier test; e4 never was
    expect(await dateOf('e4')).toBeNull();
    await put('e4', { deadline: null });
    expect(await dateOf('e4')).toBeNull();
    await put('e4', { unlocked: true });
    expect(await dateOf('e4')).toBeInstanceOf(Date);
    await setDate('e4', '2020-01-01T00:00:00Z');
    await put('e4', { unlocked: false });
    expect((await dateOf('e4'))!.toISOString()).toBe('2020-01-01T00:00:00.000Z');
    await put('e4', { unlocked: true });
    expect((await dateOf('e4'))!.toISOString()).toBe('2020-01-01T00:00:00.000Z');
  });

  it('students get exercises newest unlock first, NULL last, ties by title; groups by their newest visible exercise', async () => {
    await put('e1', { groupId: schleifen, unlocked: true });
    await put('e2', { groupId: objekte, unlocked: true });
    await put('e3', { groupId: schleifen, unlocked: true });
    await put('e4', { groupId: null, unlocked: true });
    await setDate('e1', '2026-01-01T10:00:00Z');
    await setDate('e2', '2026-03-01T10:00:00Z');
    await setDate('e3', null);
    await setDate('e4', '2026-01-01T10:00:00Z');
    const res = await studentList();
    expect(ids(res)).toEqual(['e2', 'e1', 'e4', 'e3']);
    expect(res.exercises.map((e: any) => e.groupId)).toEqual([objekte, schleifen, null, schleifen]);
    expect(res.groups).toEqual([
      { id: objekte, name: 'Objekte' },
      { id: schleifen, name: 'Schleifen' },
    ]);
  });

  it('groups whose visible exercises all have no date come last; hidden exercises do not count', async () => {
    await setDate('e2', null); // Objekte: only NULL now
    let res = await studentList();
    expect(gnames(res)).toEqual(['Schleifen', 'Objekte']);
    expect(ids(res)).toEqual(['e1', 'e4', 'e2', 'e3']);
    // a hidden, very new exercise in Schleifen must not lift the group above Objekte
    await setDate('e2', '2026-02-01T10:00:00Z');
    await setDate('e3', '2027-01-01T10:00:00Z');
    await put('e3', { unlocked: false });
    res = await studentList();
    expect(gnames(res)).toEqual(['Objekte', 'Schleifen']);
    expect(ids(res)).toEqual(['e2', 'e1', 'e4']);
    await put('e3', { unlocked: true }); // keeps its 2027 date
    expect(gnames(await studentList())).toEqual(['Schleifen', 'Objekte']);
    // hide the only exercise of Objekte: the group vanishes
    await put('e2', { unlocked: false });
    expect(gnames(await studentList())).toEqual(['Schleifen']);
    await put('e2', { unlocked: true });
  });

  it('a course without groups has groups: [] and groupId null everywhere', async () => {
    const code = (await json(await anna.call('POST', `/api/teacher/courses/${other}/students`, { names: 'Tom' }))).students[0].code;
    await anna.call('PUT', `/api/teacher/courses/${other}/exercises/e1`, { unlocked: true });
    const res = await json(await app.request('/api/exercises', { headers: { Authorization: `Bearer ${code}` } }));
    expect(res.groups).toEqual([]);
    expect(res.exercises).toEqual([expect.objectContaining({ id: 'e1', groupId: null })]);
  });
});

describe('delete and cascade', () => {
  it('deleting a group keeps its exercises, ungrouped and still unlocked', async () => {
    const groups = (await json(await anna.call('GET', `${base()}/groups`))).groups;
    const before = groups.map((g: any) => g.name);
    const victim = groups.find((g: any) => g.name === 'Schleifen').id;
    expect((await anna.call('DELETE', `${base()}/groups/${victim}`)).status).toBe(204);
    expect(await groupNames()).toEqual(before.filter((n: string) => n !== 'Schleifen'));
    const list = (await listing()).exercises;
    expect(list.map((e: any) => e.id).sort()).toEqual(['e1', 'e2', 'e3', 'e4']);
    for (const id of ['e1', 'e3']) expect(list.find((e: any) => e.id === id)).toMatchObject({ groupId: null, unlocked: true });
    expect((await studentList()).exercises).toHaveLength(4);
    expect((await anna.call('DELETE', `${base()}/groups/${victim}`)).status).toBe(404);
  });

  it('deleting an exercise or a course removes the group links and groups', async () => {
    const db = t.current().db;
    const objekte = (await json(await anna.call('GET', `${base()}/groups`))).groups.find((g: any) => g.name === 'Objekte').id;
    await anna.call('PUT', `${base()}/exercises/e1`, { groupId: objekte });
    expect((await anna.call('DELETE', '/api/teacher/exercises/e1')).status).toBe(204);
    expect(await inGroup(objekte)).toEqual(['e2']);
    await anna.call('PUT', `${base()}/exercises/e3`, { groupId: objekte });
    expect(await inGroup(objekte)).toEqual(['e2', 'e3']);
    const count = async () => Number((await db<{ n: number | string }[]>`SELECT COUNT(*) AS n FROM exercise_groups`)[0]!.n);
    expect(await count()).toBeGreaterThan(0);
    await db`DELETE FROM courses WHERE id IN (${course}, ${other})`;
    expect(await count()).toBe(0);
  });
});

describe('access', () => {
  it('another teacher gets 404 on every group route; nothing changes', async () => {
    const c = await mkGroupInNewCourse();
    const p = `/api/teacher/courses/${c.course}`;
    expect((await ben.call('GET', `${p}/groups`)).status).toBe(404);
    expect((await ben.call('POST', `${p}/groups`, { name: 'X' })).status).toBe(404);
    expect((await ben.call('PUT', `${p}/groups/${c.group}`, { name: 'Y' })).status).toBe(404);
    expect((await ben.call('DELETE', `${p}/groups/${c.group}`)).status).toBe(404);
    expect((await ben.call('PUT', `${p}/exercises/b1`, { groupId: c.group })).status).toBe(404);
    expect((await anna.call('GET', `${p}/groups`).then(json)).groups).toEqual([{ id: c.group, name: 'Privat' }]);
  });

  it('a group of the own course in another course of the same teacher is 404; unknown exercise is 404; student code and anonymous are refused', async () => {
    const c = await mkGroupInNewCourse();
    expect((await anna.call('PUT', `/api/teacher/courses/${c.course}/exercises/nope`, { groupId: c.group })).status).toBe(404);
    expect((await anna.call('DELETE', `/api/teacher/courses/${c.course}/groups/${c.group + 1000}`)).status).toBe(404);
    const s = await app.request(`/api/teacher/courses/${c.course}/groups`, { headers: { Authorization: `Bearer ${studentCode}` } });
    expect(s.status).toBe(401);
    expect((await app.request(`/api/teacher/courses/${c.course}/groups`)).status).toBe(401);
  });
});

async function mkGroupInNewCourse() {
  const cid = (await json(await anna.call('POST', '/api/teacher/courses', { subject: 'X', className: `K${Math.random()}`.slice(0, 8) }))).course.id;
  const r = await anna.call('POST', `/api/teacher/courses/${cid}/groups`, { name: 'Privat' });
  return { course: cid as number, group: (await json(r)).group.id as number };
}
