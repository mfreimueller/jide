import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../src/app.js';
import { useTestDb } from './helpers.js';

useTestDb();

beforeAll(() => {
  process.env.ALLOWED_ORIGINS = 'https://example.github.io,http://localhost:5173';
});

describe('CORS', () => {
  it('allows a configured origin, including preflight with Authorization', async () => {
    const res = await app.request('/api/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.github.io',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://example.github.io');
    expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('authorization');
  });

  it('does not send CORS headers to other origins', async () => {
    const res = await app.request('/api/health', { headers: { Origin: 'https://evil.example' } });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
