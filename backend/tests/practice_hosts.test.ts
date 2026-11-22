import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { parsePracticeHosts } from '../src/lib/practice_hosts.js';
import { signedInTeacher, useTestDb, type TestTeacher } from './helpers.js';

const t = useTestDb();
const json = async (res: Response) => (await res.json()) as any;

let anna: TestTeacher;
let ben: TestTeacher;
let courseId: number;
let otherCourseId: number;
let archivedId: number;
let code: string;
let otherCode: string;
const base = (id: number) => `/api/teacher/courses/${id}/practice-hosts`;
const studentGet = (c: string) => app.request('/api/student/practice-hosts', { headers: { Authorization: `Bearer ${c}` } });

beforeAll(async () => {
  const db = t.current().db;
  anna = await signedInTeacher(db, 'anna@school.edu', 'Anna');
  ben = await signedInTeacher(db, 'ben@school.edu', 'Ben');
  const mk = async (className: string) => (await json(await anna.call('POST', '/api/teacher/courses', { subject: 'POS', className }))).course.id;
  courseId = await mk('1BHIF');
  otherCourseId = await mk('2BHIF');
  archivedId = await mk('3BHIF');
  code = (await json(await anna.call('POST', `/api/teacher/courses/${courseId}/students`, { names: 'Ada' }))).students[0].code;
  otherCode = (await json(await anna.call('POST', `/api/teacher/courses/${otherCourseId}/students`, { names: 'Max' }))).students[0].code;
});

describe('parsePracticeHosts', () => {
  it('normalises, de-duplicates and sorts', () => {
    expect(parsePracticeHosts([' B.example.com', 'a.example.com', 'b.EXAMPLE.com'])).toEqual(['a.example.com', 'b.example.com']);
  });
  it('rejects an invalid host with a German message naming the input', () => {
    expect(() => parsePracticeHosts(['https://x.example.com'])).toThrow('„https://x.example.com“ ist kein gültiger Hostname (z. B. die-spengergasse.github.io).');
  });
  it('allows 20 and rejects 21 distinct hosts; duplicates do not count', () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => `h${i}.example.com`);
    expect(parsePracticeHosts(mk(20))).toHaveLength(20);
    expect(parsePracticeHosts([...mk(20), 'H0.example.com'])).toHaveLength(20);
    expect(() => parsePracticeHosts(mk(21))).toThrow('Höchstens 20 Hosts pro Kurs.');
  });
});

describe('teacher practice-hosts', () => {
  it('starts empty', async () => {
    const res = await anna.call('GET', base(courseId));
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ hosts: [] });
  });

  it('PUT replaces the list with the normalised, sorted hosts; GET returns it', async () => {
    const res = await anna.call('PUT', base(courseId), { hosts: ['Die-Spengergasse.github.io', 'a.example.com', 'a.example.com'] });
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ hosts: ['a.example.com', 'die-spengergasse.github.io'] });
    expect(await json(await anna.call('GET', base(courseId)))).toEqual({ hosts: ['a.example.com', 'die-spengergasse.github.io'] });
    await anna.call('PUT', base(courseId), { hosts: ['b.example.com'] });
    expect(await json(await anna.call('GET', base(courseId)))).toEqual({ hosts: ['b.example.com'] });
    expect(await json(await anna.call('GET', base(otherCourseId)))).toEqual({ hosts: [] });
  });

  it('an invalid host gives 400 and changes nothing', async () => {
    const res = await anna.call('PUT', base(courseId), { hosts: ['ok.example.com', '10.0.0.1'] });
    expect(res.status).toBe(400);
    expect((await json(res)).message).toContain('„10.0.0.1“ ist kein gültiger Hostname');
    expect(await json(await anna.call('GET', base(courseId)))).toEqual({ hosts: ['b.example.com'] });
  });

  it('a malformed body gives 400', async () => {
    expect((await anna.call('PUT', base(courseId), { hosts: 'x.example.com' })).status).toBe(400);
    expect((await anna.call('PUT', base(courseId), {})).status).toBe(400);
    expect((await anna.call('PUT', base(courseId), { hosts: [1] })).status).toBe(400);
  });

  it('more than 20 hosts gives 400', async () => {
    const hosts = Array.from({ length: 21 }, (_, i) => `h${i}.example.com`);
    const res = await anna.call('PUT', base(courseId), { hosts });
    expect(res.status).toBe(400);
    expect((await json(res)).message).toBe('Höchstens 20 Hosts pro Kurs.');
  });

  it('an empty list clears the hosts', async () => {
    expect((await anna.call('PUT', base(courseId), { hosts: [] })).status).toBe(200);
    expect(await json(await anna.call('GET', base(courseId)))).toEqual({ hosts: [] });
  });

  it('another teacher gets 404 on GET and PUT; nothing changes', async () => {
    await anna.call('PUT', base(courseId), { hosts: ['keep.example.com'] });
    expect((await ben.call('GET', base(courseId))).status).toBe(404);
    expect((await ben.call('PUT', base(courseId), { hosts: ['evil.example.com'] })).status).toBe(404);
    expect(await json(await anna.call('GET', base(courseId)))).toEqual({ hosts: ['keep.example.com'] });
  });

  it('works on an archived course like the other course settings', async () => {
    await anna.call('POST', `/api/teacher/courses/${archivedId}/archive`);
    expect((await anna.call('PUT', base(archivedId), { hosts: ['arch.example.com'] })).status).toBe(200);
    expect(await json(await anna.call('GET', base(archivedId)))).toEqual({ hosts: ['arch.example.com'] });
  });

  it('requires a teacher session', async () => {
    expect((await app.request(base(courseId))).status).toBe(401);
  });
});

describe('student practice-hosts', () => {
  it("returns the hosts of the student's own course only", async () => {
    await anna.call('PUT', base(courseId), { hosts: ['z.example.com', 'a.example.com'] });
    await anna.call('PUT', base(otherCourseId), { hosts: ['other.example.com'] });
    expect(await json(await studentGet(code))).toEqual({ hosts: ['a.example.com', 'z.example.com'] });
    expect(await json(await studentGet(otherCode))).toEqual({ hosts: ['other.example.com'] });
  });

  it('is empty for a course without hosts', async () => {
    await anna.call('PUT', base(otherCourseId), { hosts: [] });
    expect(await json(await studentGet(otherCode))).toEqual({ hosts: [] });
  });

  it('rejects an unknown code with 401', async () => {
    expect((await studentGet('AAAA-AAAA')).status).toBe(401);
    expect((await app.request('/api/student/practice-hosts')).status).toBe(401);
  });
});

describe('cascade', () => {
  it('deleting a course removes its hosts', async () => {
    const db = t.current().db;
    const count = async () => Number((await db<{ n: number | string }[]>`SELECT COUNT(*) AS n FROM course_practice_hosts WHERE course_id = ${courseId}`)[0]!.n);
    expect(await count()).toBeGreaterThan(0);
    await db`DELETE FROM students WHERE course_id = ${courseId}`;
    await db`DELETE FROM courses WHERE id = ${courseId}`;
    expect(await count()).toBe(0);
  });
});
