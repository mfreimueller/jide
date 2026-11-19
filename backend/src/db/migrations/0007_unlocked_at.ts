import type { Migration } from './index.js';

export const MIGRATION_0007_UNLOCKED_AT: Migration = {
  version: 7,
  name: 'unlocked_at',
  statements: [
    // When the exercise was unlocked for the course the first time; NULL for rows from before this column (no backfill).
    `ALTER TABLE course_exercises ADD COLUMN unlocked_at DATETIME NULL`,
  ],
};
