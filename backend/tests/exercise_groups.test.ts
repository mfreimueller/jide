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

describe('groups: create, rename, order', () => {
  it('starts empty and creates groups in order', async () => {
    expect(await groupNames()).toEqual([]);
    const r = await anna.call('POST', `${base()}/groups`, { name: '  Schleifen  ' });
    expect(r.status).toBe(201);
    expect((await json(r)).group.name).toBe('Schleifen');
    await mkGroup('Arrays');
    await mkGroup('Klassen');
    expect(await groupNames()).toEqual(['Schleifen', 'Arrays', 'Klassen']);
  });

  it('rejects empty, too long and duplicate names (also case-insensitive), allows the same name in another course', async () => {
    expect((await anna.call('POST', `${base()}/groups`, { name: '   ' })).status).toBe(400);
    expect((await anna.call('POST', `${base()}/groups`, { name: 'x'.repeat(101) })).status).toBe(400);
    expect((await anna.call('POST', `${base()}/groups`, {})).status).toBe(400);
    const dup = await anna.call('POST', `${base()}/groups`, { name: 'arrays' });
    expect(dup.status).toBe(409);
    expect((await json(dup)).message).toBe('Diese Gruppe gibt es schon.');
    expect((await anna.call('POST', `/api/teacher/courses/${other}/groups`, { name: 'Arrays' })).status).toBe(201);
    expect(await groupNames()).toEqual(['Schleifen', 'Arrays', 'Klassen']);
  });

  it('renames; duplicate on rename is rejected, the own name is fine', async () => {
    const id = (await json(await anna.call('GET', `${base()}/groups`))).groups[2].id;
    expect((await json(await anna.call('PUT', `${base()}/groups/${id}`, { name: 'Objekte' }))).group.name).toBe('Objekte');
    expect((await anna.call('PUT', `${base()}/groups/${id}`, { name: 'Objekte' })).status).toBe(200);
    const dup = await anna.call('PUT', `${base()}/groups/${id}`, { name: 'Arrays' });
    expect(dup.status).toBe(409);
    expect((await anna.call('PUT', `${base()}/groups/${id}`, { name: '' })).status).toBe(400);
    expect(await groupNames()).toEqual(['Schleifen', 'Arrays', 'Objekte']);
  });

  it('moves groups up and down; the edges stay as they are', async () => {
    const [a, b, c] = (await json(await anna.call('GET', `${base()}/groups`))).groups.map((g: any) => g.id);
    const names = async (r: Response) => (await json(r)).groups.map((g: any) => g.name);
    expect(await names(await anna.call('POST', `${base()}/groups/${b}/move`, { direction: 'up' }))).toEqual(['Arrays', 'Schleifen', 'Objekte']);
    expect(await names(await anna.call('POST', `${base()}/groups/${b}/move`, { direction: 'up' }))).toEqual(['Arrays', 'Schleifen', 'Objekte']);
    expect(await names(await anna.call('POST', `${base()}/groups/${c}/move`, { direction: 'down' }))).toEqual(['Arrays', 'Schleifen', 'Objekte']);
    expect(await names(await anna.call('POST', `${base()}/groups/${a}/move`, { direction: 'up' }))).toEqual(['Schleifen', 'Arrays', 'Objekte']);
    expect(await names(await anna.call('POST', `${base()}/groups/${b}/move`, { direction: 'down' }))).toEqual(['Schleifen', 'Objekte', 'Arrays']);
    expect(await groupNames()).toEqual(['Schleifen', 'Objekte', 'Arrays']);
    expect((await anna.call('POST', `${base()}/groups/${a}/move`, { direction: 'sideways' })).status).toBe(400);
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

  it('puts exercises into a group at the end and reports groupId and position', async () => {
    for (const s of ['e3', 'e1', 'e2']) expect((await put(s, { groupId: g1 })).status).toBe(200);
    expect(await inGroup(g1)).toEqual(['e3', 'e1', 'e2']);
    const list = await listing();
    expect(list.exercises.map((e: any) => [e.id, e.groupId, e.position])).toEqual([
      ['e3', g1, 0],
      ['e1', g1, 1],
      ['e2', g1, 2],
      ['e4', null, null],
    ]);
    expect(list.groups.map((g: any) => g.name)).toEqual(['Schleifen', 'Objekte', 'Arrays']);
  });

  it('moves exercises inside the group; edges stay', async () => {
    const mv = async (slug: string, direction: string) => {
      const r = await anna.call('POST', `${base()}/exercises/${slug}/move`, { direction });
      expect(r.status).toBe(200);
      return (await json(r)).exercises.filter((e: any) => e.groupId === g1).map((e: any) => e.id);
    };
    expect(await mv('e2', 'up')).toEqual(['e3', 'e2', 'e1']);
    expect(await mv('e3', 'up')).toEqual(['e3', 'e2', 'e1']);
    expect(await mv('e1', 'down')).toEqual(['e3', 'e2', 'e1']);
    expect(await mv('e3', 'down')).toEqual(['e2', 'e3', 'e1']);
  });

  it('cannot move an ungrouped exercise; bad direction and unknown exercise are rejected', async () => {
    expect((await anna.call('POST', `${base()}/exercises/e4/move`, { direction: 'up' })).status).toBe(400);
    expect((await anna.call('POST', `${base()}/exercises/e1/move`, { direction: 'left' })).status).toBe(400);
    expect((await anna.call('POST', `${base()}/exercises/nope/move`, { direction: 'up' })).status).toBe(404);
  });

  it('regrouping appends to the target and keeps both groups dense', async () => {
    await put('e2', { groupId: g2 });
    await put('e4', { groupId: g2 });
    expect(await inGroup(g1)).toEqual(['e3', 'e1']);
    expect(await inGroup(g2)).toEqual(['e2', 'e4']);
    const pos = (await listing()).exercises.map((e: any) => [e.id, e.position]);
    expect(pos).toEqual([['e3', 0], ['e1', 1], ['e2', 0], ['e4', 1]]);
    // take one out: ungrouped, neighbours close up
    await put('e3', { groupId: null });
    expect(await inGroup(g1)).toEqual(['e1']);
    expect((await listing()).exercises.map((e: any) => [e.id, e.groupId, e.position])).toEqual([
      ['e1', g1, 0],
      ['e2', g2, 0],
      ['e4', g2, 1],
      ['e3', null, null],
    ]);
    await put('e3', { groupId: g1 });
    expect(await inGroup(g1)).toEqual(['e1', 'e3']);
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

describe('student list', () => {
  it('shows groups in the teacher\'s order, only with visible exercises, and the group id per exercise', async () => {
    const groups = (await json(await anna.call('GET', `${base()}/groups`))).groups;
    const byName = (n: string) => groups.find((g: any) => g.name === n).id;
    // Order now: Schleifen, Objekte, Arrays. Unlock e1 (Schleifen), e2 (Objekte) and e3 (Schleifen), e4 (Objekte) stays hidden.
    for (const s of ['e1', 'e2', 'e3']) await anna.call('PUT', `${base()}/exercises/${s}`, { unlocked: true });
    await anna.call('PUT', `${base()}/exercises/e4`, { groupId: null });
    await anna.call('PUT', `${base()}/exercises/e4`, { unlocked: true });
    let res = await studentList();
    expect(res.groups).toEqual([
      { id: byName('Schleifen'), name: 'Schleifen' },
      { id: byName('Objekte'), name: 'Objekte' },
    ]);
    expect(res.exercises.map((e: any) => [e.id, e.groupId])).toEqual([
      ['e3', byName('Schleifen')],
      ['e1', byName('Schleifen')],
      ['e2', byName('Objekte')],
      ['e4', null],
    ]);
    // hide the only exercise of Objekte: the group vanishes
    await anna.call('PUT', `${base()}/exercises/e2`, { unlocked: false });
    res = await studentList();
    expect(res.groups.map((g: any) => g.name)).toEqual(['Schleifen']);
    // reorder groups: Arrays is empty/hidden, move Objekte (hidden) does not matter; move Schleifen down
    await anna.call('POST', `${base()}/groups/${byName('Schleifen')}/move`, { direction: 'down' });
    await anna.call('PUT', `${base()}/exercises/e2`, { unlocked: true });
    res = await studentList();
    expect(res.groups.map((g: any) => g.name)).toEqual(['Objekte', 'Schleifen']);
    expect(res.exercises.map((e: any) => e.id)).toEqual(['e2', 'e3', 'e1', 'e4']);
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
  it('deleting a group keeps its exercises, ungrouped and still unlocked, and closes the gap in the group order', async () => {
    const groups = (await json(await anna.call('GET', `${base()}/groups`))).groups;
    const before = groups.map((g: any) => g.name);
    const victim = groups.find((g: any) => g.name === 'Schleifen').id;
    expect((await anna.call('DELETE', `${base()}/groups/${victim}`)).status).toBe(204);
    expect(await groupNames()).toEqual(before.filter((n: string) => n !== 'Schleifen'));
    const list = (await listing()).exercises;
    expect(list.map((e: any) => e.id).sort()).toEqual(['e1', 'e2', 'e3', 'e4']);
    for (const id of ['e1', 'e3']) expect(list.find((e: any) => e.id === id)).toMatchObject({ groupId: null, position: null, unlocked: true });
    const rows = await t.current().db<{ position: number }[]>`SELECT position FROM exercise_groups WHERE course_id = ${course} ORDER BY position`;
    expect(rows.map((r) => r.position)).toEqual([0, 1]);
    expect((await studentList()).exercises).toHaveLength(4);
    expect((await anna.call('DELETE', `${base()}/groups/${victim}`)).status).toBe(404);
  });

  it('deleting an exercise or a course removes the group links and groups', async () => {
    const db = t.current().db;
    const objekte = (await json(await anna.call('GET', `${base()}/groups`))).groups.find((g: any) => g.name === 'Objekte').id;
    await anna.call('PUT', `${base()}/exercises/e1`, { groupId: objekte });
    expect((await anna.call('DELETE', '/api/teacher/exercises/e1')).status).toBe(204);
    expect(await inGroup(objekte)).toEqual(['e2']);
    // remaining positions stay usable
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
    expect((await ben.call('POST', `${p}/groups/${c.group}/move`, { direction: 'up' })).status).toBe(404);
    expect((await ben.call('DELETE', `${p}/groups/${c.group}`)).status).toBe(404);
    expect((await ben.call('POST', `${p}/exercises/b1/move`, { direction: 'up' })).status).toBe(404);
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
