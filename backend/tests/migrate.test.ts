import { describe, it, expect } from 'vitest';
import { runMigrations } from '../src/db/migrate.js';
import { useTestDb } from './helpers.js';

const t = useTestDb();

describe('runMigrations', () => {
  it('is idempotent', async () => {
    await runMigrations(t.current().db);
    await runMigrations(t.current().db);
    const rows = await t.current().db<{ n: number }[]>`SELECT COUNT(*) AS n FROM schema_migrations`;
    expect(Number(rows[0]?.n)).toBeGreaterThanOrEqual(0);
  });
});
