import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { resetRateLimits } from '../src/lib/rate_limit.js';
import { signedInTeacher, useTestDb, type TestTeacher } from './helpers.js';

const t = useTestDb();
let anna: TestTeacher;
let ben: TestTeacher;

beforeAll(async () => {
  anna = await signedInTeacher(t.current().db, 'anna@school.edu', 'Anna');
  ben = await signedInTeacher(t.current().db, 'ben@school.edu', 'Ben');
});
beforeEach(() => resetRateLimits());

async function newCourse(teacher: TestTeacher, subject = 'POS', className = '1AHIF') {
  const res = await teacher.call('POST', '/api/teacher/courses', { subject, className });
  expect(res.status).toBe(201);
  return ((await res.json()) as { course: { id: number } }).course;
}

describe('courses', () => {
  it('requires a teacher session', async () => {
    const { app } = await import('../src/app.js');
    expect((await app.request('/api/teacher/courses')).status).toBe(401);
  });

  it('creates and reads a course', async () => {
    const res = await anna.call('POST', '/api/teacher/courses', { subject: ' POS ', className: '1AHIF' });
    expect(res.status).toBe(201);
    const { course } = (await res.json()) as { course: Record<string, unknown> };
    expect(course).toMatchObject({ subject: 'POS', className: '1AHIF', archived: false, studentCount: 0 });
    expect(typeof course.createdAt).toBe('string');
    const got = await anna.call('GET', `/api/teacher/courses/${course.id}`);
    expect(((await got.json()) as { course: unknown }).course).toEqual(course);
  });

  it('rejects empty subject or class with a German message', async () => {
    const res = await anna.call('POST', '/api/teacher/courses', { subject: ' ', className: '1AHIF' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toContain('Fach');
  });

  it('archives and unarchives; the list hides archived unless asked', async () => {
    const teacher = await signedInTeacher(t.current().db, 'cleo@school.edu', 'Cleo');
    const a = await newCourse(teacher, 'POS', '2AHIF');
    const b = await newCourse(teacher, 'DBI', '2AHIF');
    const arch = await teacher.call('POST', `/api/teacher/courses/${a.id}/archive`);
    expect(((await arch.json()) as { course: { archived: boolean } }).course.archived).toBe(true);

    const ids = async (q: string) =>
      ((await (await teacher.call('GET', `/api/teacher/courses${q}`)).json()) as { courses: { id: number }[] }).courses.map((c) => c.id);
    expect(await ids('')).toEqual([b.id]);
    expect(await ids('?archived=1')).toEqual([b.id, a.id]);

    await teacher.call('POST', `/api/teacher/courses/${a.id}/unarchive`);
    expect(await ids('')).toEqual(expect.arrayContaining([a.id, b.id]));
  });

  it('hides other teachers courses (404) for every route', async () => {
    const course = await newCourse(anna);
    const base = `/api/teacher/courses/${course.id}`;
    for (const [method, path, body] of [
      ['GET', base],
      ['POST', `${base}/archive`],
      ['POST', `${base}/unarchive`],
      ['GET', `${base}/students`],
      ['POST', `${base}/students`, { names: 'Eva' }],
    ] as const) {
      const res = await ben.call(method, path, body);
      expect(res.status, `${method} ${path}`).toBe(404);
    }
    const list = (await (await ben.call('GET', '/api/teacher/courses?archived=1')).json()) as { courses: { id: number }[] };
    expect(list.courses.map((c) => c.id)).not.toContain(course.id);
    const stillActive = (await (await anna.call('GET', base)).json()) as { course: { archived: boolean } };
    expect(stillActive.course.archived).toBe(false);
  });

  it('404s for non-numeric and unknown ids', async () => {
    expect((await anna.call('GET', '/api/teacher/courses/abc')).status).toBe(404);
    expect((await anna.call('GET', '/api/teacher/courses/999999')).status).toBe(404);
  });
});

describe('students', () => {
  it('adds students from pasted text with personal codes', async () => {
    const course = await newCourse(anna);
    const res = await anna.call('POST', `/api/teacher/courses/${course.id}/students`, {
      names: '  Eva Maier \r\n\n   \nTom   Huber\n',
    });
    expect(res.status).toBe(201);
    const { students } = (await res.json()) as { students: { name: string; code: string; lastActivityAt: unknown; handInCount: number }[] };
    expect(students.map((s) => s.name)).toEqual(['Eva Maier', 'Tom Huber']);
    for (const s of students) {
      expect(s.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
      expect(s.lastActivityAt).toBeNull();
      expect(s.handInCount).toBe(0);
    }
    expect(students[0]!.code).not.toBe(students[1]!.code);

    const list = (await (await anna.call('GET', `/api/teacher/courses/${course.id}/students`)).json()) as { students: unknown[] };
    expect(list.students).toEqual(students);
    const c = (await (await anna.call('GET', `/api/teacher/courses/${course.id}`)).json()) as { course: { studentCount: number } };
    expect(c.course.studentCount).toBe(2);
  });

  it('rejects an empty paste, too many names and over-long names with German messages', async () => {
    const course = await newCourse(anna);
    const url = `/api/teacher/courses/${course.id}/students`;
    for (const names of ['', ' \n \n', Array.from({ length: 61 }, (_, i) => `S${i}`).join('\n'), 'x'.repeat(101)]) {
      const res = await anna.call('POST', url, { names });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { message: string }).message).toMatch(/Namen|Name/);
    }
    const ok = await anna.call('POST', url, { names: Array.from({ length: 60 }, (_, i) => `S${i}`).join('\n') });
    expect(ok.status).toBe(201);
    const list = (await (await anna.call('GET', url)).json()) as { students: unknown[] };
    expect(list.students).toHaveLength(60);
  });

  it('does not add anything when the paste is rejected', async () => {
    const course = await newCourse(anna);
    const url = `/api/teacher/courses/${course.id}/students`;
    await anna.call('POST', url, { names: `Gut\n${'x'.repeat(101)}` });
    const list = (await (await anna.call('GET', url)).json()) as { students: unknown[] };
    expect(list.students).toHaveLength(0);
  });

  it('cannot reset the code of a student from another course or teacher', async () => {
    const mine = await newCourse(anna);
    const other = await newCourse(anna, 'DBI', '1AHIF');
    const added = (await (await anna.call('POST', `/api/teacher/courses/${mine.id}/students`, { names: 'Eva' })).json()) as {
      students: { id: number }[];
    };
    const sid = added.students[0]!.id;
    expect((await anna.call('POST', `/api/teacher/courses/${other.id}/students/${sid}/reset-code`)).status).toBe(404);
    expect((await ben.call('POST', `/api/teacher/courses/${mine.id}/students/${sid}/reset-code`)).status).toBe(404);
  });
});
