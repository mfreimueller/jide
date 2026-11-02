import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { app } from '../src/app.js';
import { MAX_ENTRIES, MAX_UPLOAD_BYTES } from '../src/lib/exercise_package.js';
import { resetRateLimits } from '../src/lib/rate_limit.js';
import { signedInTeacher, useTestDb, type TestTeacher } from './helpers.js';

const t = useTestDb();
const examples = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../examples');

function readDir(dir: string, base = dir, out: Zippable = {}): Zippable {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) readDir(full, base, out);
    else out[path.relative(base, full).split(path.sep).join('/')] = new Uint8Array(readFileSync(full));
  }
  return out;
}

/** The example folder zipped with the folder at the zip root (`summe/exercise.yaml`) or with files at the root. */
function exampleZip(name: 'summe' | 'maximum', layout: 'folder' | 'root' = 'folder'): Uint8Array {
  const files = readDir(path.join(examples, name));
  if (layout === 'root') return zipSync(files);
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [`${name}/${k}`, v])));
}

const MINIMAL: Record<string, string> = {
  'exercise.yaml': 'id: mini\ntitle: Mini\nfiles:\n  - path: Mini.java\nmainFile: Mini.java\n',
  'aufgabe.md': '# Mini',
  'files/Mini.java': 'class Mini {}',
};
function minimalZip(overrides: Record<string, string | null> = {}): Uint8Array {
  const merged = { ...MINIMAL, ...overrides };
  const z: Zippable = {};
  for (const [k, v] of Object.entries(merged)) if (v !== null) z[k] = strToU8(v);
  return zipSync(z);
}

let anna: TestTeacher;
let ben: TestTeacher;

beforeAll(async () => {
  anna = await signedInTeacher(t.current().db, 'anna@school.edu', 'Anna');
  ben = await signedInTeacher(t.current().db, 'ben@school.edu', 'Ben');
});
beforeEach(() => resetRateLimits());

async function upload(teacher: TestTeacher, body: Uint8Array | string, headers: Record<string, string> = {}) {
  return rawRequest(teacher, 'POST', '/api/teacher/exercises', body, headers);
}

const tokens = new WeakMap<TestTeacher, string>();
async function rawRequest(teacher: TestTeacher, method: string, p: string, body?: Uint8Array | string, headers: Record<string, string> = {}) {
  let token = tokens.get(teacher);
  if (!token) {
    const { createSession } = await import('../src/lib/teacher_auth.js');
    token = (await createSession(t.current().db, teacher.id)).token;
    tokens.set(teacher, token);
  }
  return app.request(p, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/zip', ...headers },
    body: body as RequestInit['body'],
  });
}

async function json<T = any>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function newCourse(teacher: TestTeacher) {
  const res = await teacher.call('POST', '/api/teacher/courses', { subject: 'POS', className: '1AHIF' });
  return (await json(res)).course as { id: number };
}

async function studentIn(teacher: TestTeacher, courseId: number, name = 'Max') {
  const res = await teacher.call('POST', `/api/teacher/courses/${courseId}/students`, { names: name });
  const code = (await json(res)).students[0].code as string;
  const call = (p: string, headers: Record<string, string> = {}) => app.request(p, { headers: { Authorization: `Bearer ${code}`, ...headers } });
  return { code, call };
}

const setCourse = (teacher: TestTeacher, courseId: number, ex: string, body: unknown) =>
  teacher.call('PUT', `/api/teacher/courses/${courseId}/exercises/${ex}`, body);

describe('upload', () => {
  it('requires a teacher session', async () => {
    expect((await app.request('/api/teacher/exercises', { method: 'POST', body: minimalZip() })).status).toBe(401);
    expect((await app.request('/api/teacher/exercises')).status).toBe(401);
  });

  it.each(['summe', 'maximum'] as const)('accepts the example %s (folder at zip root) and normalises it to <id>/', async (name) => {
    const res = await upload(anna, exampleZip(name));
    expect(res.status).toBe(201);
    const { exercise, replaced } = await json(res);
    expect(replaced).toBe(false);
    expect(exercise).toMatchObject({ id: name });
    expect(exercise.version).toMatch(/^[0-9a-f]{64}$/);
    expect(exercise.size).toBeGreaterThan(0);

    const stored = Object.keys(unzipSync(await downloadFor(anna, exercise.id)));
    expect(stored.length).toBeGreaterThan(2);
    expect(stored.every((n) => n.startsWith(`${name}/`))).toBe(true);
    expect(stored).toContain(`${name}/exercise.yaml`);
  });

  it('accepts files at the zip root', async () => {
    const res = await upload(ben, exampleZip('summe', 'root'));
    expect(res.status).toBe(201);
    expect((await json(res)).exercise.id).toBe('summe');
  });

  it('gives both layouts the same version (deterministic normalisation)', async () => {
    const a = await json(await upload(anna, exampleZip('summe', 'folder')));
    const b = await json(await upload(anna, exampleZip('summe', 'root')));
    expect(b.exercise.version).toBe(a.exercise.version);
  });

  it('ignores __MACOSX and .DS_Store entries', async () => {
    const z = zipSync({
      'mini/exercise.yaml': strToU8(MINIMAL['exercise.yaml']!),
      'mini/aufgabe.md': strToU8('x'),
      'mini/files/Mini.java': strToU8('class Mini {}'),
      'mini/.DS_Store': strToU8('junk'),
      '__MACOSX/mini/._exercise.yaml': strToU8('junk'),
    });
    expect((await upload(anna, z)).status).toBeLessThan(300);
  });

  it('lists and reads the teachers exercises', async () => {
    const list = await json(await anna.call('GET', '/api/teacher/exercises'));
    expect(list.exercises.map((e: { id: string }) => e.id)).toEqual(expect.arrayContaining(['summe', 'maximum', 'mini']));
    expect(Object.keys(list.exercises[0]).sort()).toEqual(['id', 'size', 'title', 'uploadedAt', 'version']);
    const one = await json(await anna.call('GET', '/api/teacher/exercises/summe'));
    expect(one.exercise.id).toBe('summe');
  });

  it('replaces the package on re-upload: new version, same row, unlock and deadline stay', async () => {
    const course = await newCourse(anna);
    const first = await json(await upload(anna, minimalZip({ 'exercise.yaml': MINIMAL['exercise.yaml']!.replace('Mini\n', 'Eins\n') })));
    await setCourse(anna, course.id, 'mini', { unlocked: true, deadline: '2026-12-01T22:59:00Z' });
    const rowCount = async () =>
      Number((await t.current().db<{ n: number }[]>`SELECT COUNT(*) AS n FROM exercises WHERE slug = 'mini'`)[0]!.n);
    const before = await rowCount();

    const res = await upload(anna, minimalZip({ 'files/Mini.java': 'class Mini { int v2; }' }));
    expect(res.status).toBe(200);
    const second = await json(res);
    expect(second.replaced).toBe(true);
    expect(second.exercise.version).not.toBe(first.exercise.version);
    expect(second.exercise.title).toBe('Mini');
    expect(await rowCount()).toBe(before);

    const listed = (await json(await anna.call('GET', `/api/teacher/courses/${course.id}/exercises`))).exercises.find(
      (e: { id: string }) => e.id === 'mini'
    );
    expect(listed).toMatchObject({ unlocked: true, deadline: '2026-12-01T22:59:00.000Z', version: second.exercise.version });
  });

  it('keeps exercise ids per teacher: the same id for two teachers gives two exercises', async () => {
    const same = minimalZip({ 'exercise.yaml': MINIMAL['exercise.yaml']!.replace('id: mini', 'id: both-use-it') });
    expect((await json(await upload(anna, same))).replaced).toBe(false);
    expect((await json(await upload(ben, same))).replaced).toBe(false);
    const rows = await t.current().db<{ n: number }[]>`SELECT COUNT(*) AS n FROM exercises WHERE slug = 'both-use-it'`;
    expect(Number(rows[0]!.n)).toBe(2);
  });

  it('isolates exercises between teachers', async () => {
    await upload(anna, minimalZip({ 'exercise.yaml': MINIMAL['exercise.yaml']!.replace('mini', 'only-anna') }));
    expect((await ben.call('GET', '/api/teacher/exercises/only-anna')).status).toBe(404);
    const benList = await json(await ben.call('GET', '/api/teacher/exercises'));
    expect(benList.exercises.map((e: { id: string }) => e.id)).not.toContain('only-anna');
    const course = await newCourse(ben);
    expect((await setCourse(ben, course.id, 'only-anna', { unlocked: true })).status).toBe(404);
  });
});

describe('upload validation (400, German)', () => {
  const expectBad = async (res: Response, text: string | RegExp) => {
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error).toBe('INVALID_EXERCISE');
    expect(body.message).toMatch(text);
  };

  it('rejects an empty body', async () => expectBad(await upload(anna, new Uint8Array(0)), 'keine Datei'));
  it('rejects a file that is not a zip', async () => expectBad(await upload(anna, 'hallo welt'), 'kein gültiges ZIP'));
  it('rejects a zip without exercise.yaml', async () =>
    expectBad(await upload(anna, minimalZip({ 'exercise.yaml': null })), 'exercise.yaml fehlt'));
  it('rejects a zip with several top-level folders and no exercise.yaml', async () =>
    expectBad(await upload(anna, zipSync({ 'a/x.txt': strToU8('1'), 'b/y.txt': strToU8('2') })), 'exercise.yaml fehlt'));
  it('names the missing listed file', async () =>
    expectBad(await upload(anna, minimalZip({ 'files/Mini.java': null })), 'files/Mini.java fehlt'));
  it('names the missing aufgabe.md', async () => expectBad(await upload(anna, minimalZip({ 'aufgabe.md': null })), 'aufgabe.md fehlt'));
  it('passes on YAML errors from the parser', async () =>
    expectBad(await upload(anna, minimalZip({ 'exercise.yaml': 'id: [unclosed\n' })), 'kein gültiges YAML'));
  it('passes on schema errors from the parser', async () =>
    expectBad(await upload(anna, minimalZip({ 'exercise.yaml': MINIMAL['exercise.yaml']!.replace('id: mini', 'id: Mini Ex') })), 'id darf nur'));

  it('rejects a broken tests.yaml with the German parser message', async () =>
    expectBad(await upload(anna, minimalZip({ 'tests.yaml': 'tests: []\n' })), 'tests.yaml ist ungültig: tests darf nicht leer sein'));
  it('accepts a valid tests.yaml', async () =>
    expect((await upload(anna, minimalZip({ 'tests.yaml': 'tests:\n  - {name: a, type: io, expected: "1"}\n' }))).status).toBeLessThan(300));

  it('rejects zip-slip entries', async () => {
    const z = zipSync({ ...Object.fromEntries(Object.entries(MINIMAL).map(([k, v]) => [k, strToU8(v)])), '../evil.txt': strToU8('x') });
    await expectBad(await upload(anna, z), 'Ungültiger Dateipfad');
    const z2 = zipSync({ 'mini/exercise.yaml': strToU8('x'), 'mini/../../evil.txt': strToU8('x') });
    await expectBad(await upload(anna, z2), 'Ungültiger Dateipfad');
  });
  it('rejects absolute paths and backslashes', async () => {
    await expectBad(await upload(anna, zipSync({ '/etc/passwd': strToU8('x') })), 'Ungültiger Dateipfad');
    await expectBad(await upload(anna, zipSync({ 'C:/x.txt': strToU8('x') })), 'Ungültiger Dateipfad');
    await expectBad(await upload(anna, zipSync({ 'a\\..\\b.txt': strToU8('x') })), 'Ungültiger Dateipfad');
  });
  it('rejects symlinks', async () => {
    const z = zipSync({
      'exercise.yaml': strToU8(MINIMAL['exercise.yaml']!),
      link: [strToU8('/etc/passwd'), { os: 3, attrs: (0o120777 << 16) >>> 0 }],
    });
    await expectBad(await upload(anna, z), 'symbolische Links');
  });
  it('rejects too many files', async () => {
    const z: Zippable = {};
    for (let i = 0; i <= MAX_ENTRIES; i++) z[`f${i}.txt`] = strToU8('x');
    await expectBad(await upload(anna, zipSync(z)), 'zu viele Dateien');
  });
  it('rejects zip bombs by declared uncompressed size', async () => {
    const big = new Uint8Array(30 * 1024 * 1024); // compresses to a few KB
    const z = zipSync({ 'a.bin': big, 'b.bin': big });
    expect(z.length).toBeLessThan(MAX_UPLOAD_BYTES);
    await expectBad(await upload(anna, z), 'entpackt zu groß');
  });

  it('rejects oversize uploads with 413 and a German message (Content-Length)', async () => {
    const res = await upload(anna, new Uint8Array(MAX_UPLOAD_BYTES + 1));
    expect(res.status).toBe(413);
    expect((await json(res)).message).toContain('zu groß');
  });
  it('rejects oversize streamed uploads without Content-Length', async () => {
    const chunk = new Uint8Array(1024 * 1024);
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent++ < 12) controller.enqueue(chunk);
        else controller.close();
      },
    });
    let token = tokens.get(anna);
    if (!token) {
      await upload(anna, minimalZip());
      token = tokens.get(anna)!;
    }
    const res = await app.request(
      new Request('http://localhost/api/teacher/exercises', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/zip' },
        body: stream,
        duplex: 'half',
      } as RequestInit)
    );
    expect(res.status).toBe(413);
  });
});

async function downloadFor(teacher: TestTeacher, id: string): Promise<Uint8Array> {
  // Teachers have no download route; read the stored package straight from the table.
  const rows = await t.current().db<{ p: Buffer }[]>`
    SELECT package AS p FROM exercises WHERE teacher_id = ${teacher.id} AND slug = ${id}
  `;
  return new Uint8Array(rows[0]!.p);
}

describe('per-course unlock and deadline', () => {
  it('lists all of the teachers exercises per course, locked by default', async () => {
    const course = await newCourse(anna);
    const res = await anna.call('GET', `/api/teacher/courses/${course.id}/exercises`);
    expect(res.status).toBe(200);
    const { exercises } = await json(res);
    expect(exercises.length).toBeGreaterThanOrEqual(2);
    for (const e of exercises) expect(e).toMatchObject({ unlocked: false, deadline: null });
    expect(Object.keys(exercises[0]).sort()).toEqual(['deadline', 'groupId', 'id', 'position', 'size', 'title', 'unlocked', 'uploadedAt', 'version']);
  });

  it('unlocks, hides, sets and clears the deadline independently', async () => {
    const course = await newCourse(anna);
    let res = await setCourse(anna, course.id, 'summe', { unlocked: true });
    expect(await json(res)).toMatchObject({ exercise: { id: 'summe', unlocked: true, deadline: null } });

    // 24:00 Vienna time (CET, UTC+1) on 1 Dec = 23:00 UTC; the API takes any ISO offset and stores UTC.
    res = await setCourse(anna, course.id, 'summe', { deadline: '2026-12-02T00:00:00+01:00' });
    expect(await json(res)).toMatchObject({ exercise: { unlocked: true, deadline: '2026-12-01T23:00:00.000Z' } });

    res = await setCourse(anna, course.id, 'summe', { unlocked: false });
    expect(await json(res)).toMatchObject({ exercise: { unlocked: false, deadline: '2026-12-01T23:00:00.000Z' } });

    res = await setCourse(anna, course.id, 'summe', { deadline: null });
    expect(await json(res)).toMatchObject({ exercise: { unlocked: false, deadline: null } });
  });

  it('validates the body', async () => {
    const course = await newCourse(anna);
    expect((await setCourse(anna, course.id, 'summe', {})).status).toBe(400);
    expect((await setCourse(anna, course.id, 'summe', { deadline: 'morgen' })).status).toBe(400);
    expect((await setCourse(anna, course.id, 'summe', { unlocked: 'ja' })).status).toBe(400);
    expect((await setCourse(anna, course.id, 'gibts-nicht', { unlocked: true })).status).toBe(404);
  });

  it('requires ownership of the course', async () => {
    const course = await newCourse(anna);
    expect((await ben.call('GET', `/api/teacher/courses/${course.id}/exercises`)).status).toBe(404);
    expect((await setCourse(ben, course.id, 'summe', { unlocked: true })).status).toBe(404);
  });
});

describe('student API', () => {
  it('requires a valid student code', async () => {
    expect((await app.request('/api/exercises')).status).toBe(401);
    expect((await app.request('/api/exercises/summe', { headers: { Authorization: 'Bearer NOPE-NOPE' } })).status).toBe(401);
  });

  it('shows only unlocked exercises of the own course, with deadline', async () => {
    const c1 = await newCourse(anna);
    const c2 = await newCourse(anna);
    const s1 = await studentIn(anna, c1.id);
    const s2 = await studentIn(anna, c2.id, 'Lea');
    await setCourse(anna, c1.id, 'summe', { unlocked: true, deadline: '2026-12-01T22:59:00Z' });
    await setCourse(anna, c1.id, 'maximum', { unlocked: false });
    await setCourse(anna, c2.id, 'maximum', { unlocked: true });

    const l1 = await json(await s1.call('/api/exercises'));
    expect(l1.exercises).toHaveLength(1);
    expect(l1.exercises[0]).toMatchObject({ id: 'summe', title: 'Summe zweier Zahlen', deadline: '2026-12-01T22:59:00.000Z' });
    expect(l1.exercises[0].version).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(l1.exercises[0]).sort()).toEqual(['deadline', 'groupId', 'id', 'title', 'version']);

    const l2 = await json(await s2.call('/api/exercises'));
    expect(l2.exercises.map((e: { id: string }) => e.id)).toEqual(['maximum']);
    expect(l2.exercises[0].deadline).toBeNull();

    // not unlocked for this course -> 404, even though the exercise exists
    const hidden = await s2.call('/api/exercises/summe');
    expect(hidden.status).toBe(404);
    expect((await json(hidden)).message).toContain('nicht verfügbar');
    expect((await s2.call('/api/exercises/gibts-nicht')).status).toBe(404);
  });

  it('downloads the zip only while unlocked; hiding makes it 404 again', async () => {
    const course = await newCourse(anna);
    const s = await studentIn(anna, course.id);
    expect((await s.call('/api/exercises/summe')).status).toBe(404);

    await setCourse(anna, course.id, 'summe', { unlocked: true });
    const res = await s.call('/api/exercises/summe');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    const names = Object.keys(unzipSync(new Uint8Array(await res.arrayBuffer())));
    expect(names).toContain('summe/exercise.yaml');

    await setCourse(anna, course.id, 'summe', { unlocked: false });
    expect((await s.call('/api/exercises/summe')).status).toBe(404);
    expect(((await json(await s.call('/api/exercises'))).exercises as unknown[]).length).toBe(0);
  });

  it('answers conditional requests via ETag = version, and a new upload changes it', async () => {
    const course = await newCourse(anna);
    const s = await studentIn(anna, course.id);
    await upload(anna, minimalZip({ 'exercise.yaml': MINIMAL['exercise.yaml']!.replace('id: mini', 'id: etag-ex') }));
    await setCourse(anna, course.id, 'etag-ex', { unlocked: true });

    const first = await s.call('/api/exercises/etag-ex');
    const etag = first.headers.get('etag')!;
    const version = (await json(await s.call('/api/exercises'))).exercises[0].version;
    expect(etag).toBe(`"${version}"`);

    const cached = await s.call('/api/exercises/etag-ex', { 'If-None-Match': etag });
    expect(cached.status).toBe(304);
    expect(await cached.text()).toBe('');
    expect((await s.call('/api/exercises/etag-ex', { 'If-None-Match': `W/${etag}, "other"` })).status).toBe(304);
    expect((await s.call('/api/exercises/etag-ex', { 'If-None-Match': '"stale"' })).status).toBe(200);

    await upload(anna, minimalZip({ 'exercise.yaml': MINIMAL['exercise.yaml']!.replace('id: mini', 'id: etag-ex'), 'files/Mini.java': 'class Mini { int x; }' }));
    const after = await s.call('/api/exercises/etag-ex', { 'If-None-Match': etag });
    expect(after.status).toBe(200);
    expect(after.headers.get('etag')).not.toBe(etag);
  });

  it('does not reveal a hidden exercise through If-None-Match', async () => {
    const course = await newCourse(anna);
    const s = await studentIn(anna, course.id);
    const res = await s.call('/api/exercises/summe', { 'If-None-Match': '*' });
    expect(res.status).toBe(404);
  });
});
