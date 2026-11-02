import type { Migration } from './index.js';

export const MIGRATION_0005_STUDENT_ARCHIVE: Migration = {
  version: 5,
  name: 'student_archive',
  statements: [
    // Removed students are archived, not deleted: their hand-ins stay in the database.
    `ALTER TABLE students ADD COLUMN archived_at DATETIME NULL`,
  ],
};
