import type { Migration } from './index.js';

export const MIGRATION_0008_DIFFICULTY: Migration = {
  version: 8,
  name: 'difficulty',
  statements: [
    // newbie | advanced | pro from exercise.yaml; NULL for packages uploaded before this column (until uploaded again).
    `ALTER TABLE exercises ADD COLUMN difficulty VARCHAR(16) NULL`,
  ],
};
