import { describe, it, expect } from 'vitest';
import { app } from '../src/app.js';
import { useTestDb } from './helpers.js';

useTestDb();

describe('GET /api/health', () => {
  it('reports ok with a working database', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe('ok');
    expect(body.db).toBe('ok');
    expect(body.timestamp).toBeTypeOf('string');
  });

  it('answers unknown routes with the standard error shape', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'NOT_FOUND' });
  });
});
