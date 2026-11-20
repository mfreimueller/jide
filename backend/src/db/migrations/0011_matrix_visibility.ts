import type { Migration } from './index.js';

export const MIGRATION_0011_MATRIX_VISIBILITY: Migration = {
  version: 11,
  name: 'matrix_visibility',
  statements: [
    // Teacher setting per course: hide exercises that already have a graded hand-in in the hand-in matrix.
    `ALTER TABLE courses ADD COLUMN hide_graded BOOLEAN NOT NULL DEFAULT TRUE`,
    // Manual override per exercise of the course; NULL = automatic (follows hide_graded).
    `ALTER TABLE course_exercises ADD COLUMN matrix_visibility ENUM('hidden','shown') NULL`,
  ],
};
