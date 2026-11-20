import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { hashToken } from '../src/lib/hash.js';
import { signedInTeacher, useTestDb, type TestTeacher } from './helpers.js';

const t = useTestDb();
let anna: TestTeacher;
let ben: TestTeacher;

const json = async (res: Response) => (await res.json()) as any;

beforeAll(async () => {
  anna = await signedInTeacher(t.current().db, 'anna@school.edu', 'Anna');
  ben = await signedInTeacher(t.current().db, 'ben@school.edu', 'Ben');
});

describe('API keys (teacher routes)', () => {
  it('requires a teacher session', async () => {
    expect((await app.request('/api/teacher/api-keys')).status).toBe(401);
    expect((await app.request('/api/teacher/api-keys', { method: 'POST' })).status).toBe(401);
    expect((await app.request('/api/teacher/api-keys/1', { method: 'DELETE' })).status).toBe(401);
  });

  it('creates a key, shows it once and stores only the hash', async () => {
    const res = await anna.call('POST', '/api/teacher/api-keys', { name: '  Grader Laptop ' });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.key).toMatch(/^jide_[A-Za-z0-9_-]{32}$/);
    expect(body.apiKey).toMatchObject({ name: 'Grader Laptop', prefix: body.key.slice(0, 9), lastUsedAt: null });
    expect(body.apiKey.createdAt).toMatch(/^\d{4}-/);
    const rows = await t.current().db<{ hash: string }[]>`SELECT token_hash AS hash FROM api_keys WHERE id = ${body.apiKey.id}`;
    expect(rows[0]!.hash).toBe(hashToken(body.key));
    expect(JSON.stringify(rows)).not.toContain(body.key);
  });

  it('generates different keys', async () => {
    const a = await json(await anna.call('POST', '/api/teacher/api-keys', { name: 'x' }));
    const b = await json(await anna.call('POST', '/api/teacher/api-keys', { name: 'x' }));
    expect(a.key).not.toBe(b.key);
  });

  it('lists only the own keys and never the full key', async () => {
    const created = await json(await ben.call('POST', '/api/teacher/api-keys', { name: 'Bens Schlüssel' }));
    const list = await json(await ben.call('GET', '/api/teacher/api-keys'));
    expect(list.apiKeys.map((k: any) => k.name)).toEqual(['Bens Schlüssel']);
    expect(JSON.stringify(list)).not.toContain(created.key);
    expect(Object.keys(list.apiKeys[0]).sort()).toEqual(['createdAt', 'id', 'lastUsedAt', 'name', 'prefix']);
  });

  it('validates the name', async () => {
    for (const name of ['', '   ', 'x'.repeat(101), 5, undefined]) {
      const res = await anna.call('POST', '/api/teacher/api-keys', { name });
      expect(res.status).toBe(400);
      expect((await json(res)).error).toBe('VALIDATION');
    }
    expect((await anna.call('POST', '/api/teacher/api-keys', { name: 'x'.repeat(100) })).status).toBe(201);
  });

  it('revokes a key: hidden from the list, second revoke is 404', async () => {
    const created = await json(await anna.call('POST', '/api/teacher/api-keys', { name: 'weg' }));
    expect((await anna.call('DELETE', `/api/teacher/api-keys/${created.apiKey.id}`)).status).toBe(204);
    const list = await json(await anna.call('GET', '/api/teacher/api-keys'));
    expect(list.apiKeys.some((k: any) => k.id === created.apiKey.id)).toBe(false);
    expect((await anna.call('DELETE', `/api/teacher/api-keys/${created.apiKey.id}`)).status).toBe(404);
  });

  it("cannot revoke another teacher's key", async () => {
    const created = await json(await ben.call('POST', '/api/teacher/api-keys', { name: 'Ben 2' }));
    expect((await anna.call('DELETE', `/api/teacher/api-keys/${created.apiKey.id}`)).status).toBe(404);
    const list = await json(await ben.call('GET', '/api/teacher/api-keys'));
    expect(list.apiKeys.some((k: any) => k.id === created.apiKey.id)).toBe(true);
    expect((await anna.call('DELETE', '/api/teacher/api-keys/abc')).status).toBe(404);
  });
});
