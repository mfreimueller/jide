import type { Migration } from './index.js';

export const MIGRATION_0013_KIND: Migration = {
  version: 13,
  name: 'kind',
  statements: [
    // `difficulty` (0008) is retired; no data mapping.
    `ALTER TABLE exercises DROP COLUMN difficulty`,
    // pflicht | uebung | bonus from exercise.yaml; NULL = Pflicht (also for packages uploaded before this column, until uploaded again).
    `ALTER TABLE exercises ADD COLUMN kind VARCHAR(16) NULL`,
  ],
};
