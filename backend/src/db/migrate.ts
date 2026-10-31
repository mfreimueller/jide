import type { SQLInstance } from './sql.js';
import { MIGRATIONS } from './migrations/index.js';

const CREATE_SCHEMA_MIGRATIONS = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INT PRIMARY KEY,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)
`;

export async function runMigrations(db: SQLInstance): Promise<void> {
  await db.unsafe(CREATE_SCHEMA_MIGRATIONS);

  const rows = await db<{ version: number | null }[]>`
    SELECT MAX(version) AS version FROM schema_migrations
  `;
  const currentVersion = rows[0]?.version ?? 0;

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version
  );

  for (const migration of pending) {
    for (const stmt of migration.statements) {
      await db.unsafe(stmt);
    }
    await db`INSERT INTO schema_migrations (version) VALUES (${migration.version})`;
  }
}
